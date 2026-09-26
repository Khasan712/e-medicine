"""Customer web shop: a single-page app (website + Telegram Mini App) and its JSON API."""
import base64
import hashlib
import json
import logging
import re
import secrets
from datetime import timedelta
from functools import wraps

from django.conf import settings
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.db.models import Count, F, Func, Q, Value
from django.http import Http404, HttpResponse, JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.csrf import csrf_exempt

from app.enums import DeliveryTypeEnum, LoginTokenStatusEnum, OrderEnum, OrderSourceEnum, PaymentMethodEnum
from app.models import Category, Client, Order, OrderItem, PhoneOTP, Product, TelegramLoginToken
from app.services import OrderError, create_order, is_coordinates, resolve_items
from app.telegram import get_bot_username, notify_new_order
from app.utils import normalize_phone, parse_price, parse_quantity
from .auth import get_request_client, issue_token, validate_webapp_init_data
from .sms import SmsError, send_code

logger = logging.getLogger('shop')

UZ_PHONE_RE = re.compile(r'^\+998\d{9}$')
OTP_TTL = timedelta(minutes=5)
OTP_RESEND_SECONDS = 60
OTP_MAX_PER_HOUR = 5
OTP_MAX_ATTEMPTS = 5
TELEGRAM_LOGIN_TTL = timedelta(minutes=5)
LANGS = ('uz', 'ru')


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def error(code, status=400, **extra):
    return JsonResponse({'error': code, **extra}, status=status)


def api(methods=('GET',), auth=False):
    """JSON endpoint: bearer-token auth (no cookies → no CSRF), JSON body parsing, method check."""
    def decorator(view):
        @csrf_exempt
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return error('method_not_allowed', 405)
            request.shop_client = get_request_client(request)
            if auth and request.shop_client is None:
                return error('auth_required', 401)
            request.data = {}
            if request.method in ('POST', 'PATCH'):
                try:
                    request.data = json.loads(request.body or b'{}')
                except ValueError:
                    return error('invalid_json')
                if not isinstance(request.data, dict):
                    return error('invalid_json')
            return view(request, *args, **kwargs)
        return wrapper
    return decorator


def client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    return forwarded.split(',')[0].strip() or request.META.get('REMOTE_ADDR')


def rate_limited(key, limit, window_seconds):
    cache_key = f'shop-rl:{key}'
    cache.add(cache_key, 0, window_seconds)
    try:
        count = cache.incr(cache_key)
    except ValueError:  # expired between add() and incr()
        cache.set(cache_key, 1, window_seconds)
        count = 1
    return count > limit


def text(value, limit):
    return str(value or '').strip()[:limit]


def pick_lang(value, default='uz'):
    return value if value in LANGS else default


def digits_only(field):
    return Func(F(field), Value(r'\D'), Value(''), Value('g'), function='regexp_replace')


# ---------------------------------------------------------------------------
# serializers
# ---------------------------------------------------------------------------

def product_image_url(product):
    if product.img and product.img.name:
        try:
            if default_storage.exists(product.img.name):
                return product.img.url
        except (OSError, ValueError):
            pass
    if product.img_64:
        return reverse('shop:product_image', args=[product.pk])
    return None


def product_data(product):
    measure = product.measure
    return {
        'id': product.pk,
        'name_uz': product.name_uz,
        'name_ru': product.name_ru or product.name_uz,
        'desc_uz': product.desc_uz or '',
        'desc_ru': product.desc_ru or product.desc_uz or '',
        'price': parse_price(product.price),
        'unit_uz': measure.name_uz if measure else '',
        'unit_ru': measure.name_ru if measure else '',
        'category_id': product.category_id,
        'image': product_image_url(product),
    }


def client_data(client):
    return {
        'id': client.pk,
        'first_name': client.first_name or '',
        'last_name': client.last_name or '',
        'phone': client.phone or client.tg_phone or '',
        'telegram': bool(client.tg_id),
        'tg_nick': client.tg_nick or '',
        'lang': client.lang or '',
        'address': '' if is_coordinates(client.location) else (client.location or ''),
        'lat': client.l_t or '',
        'lng': client.e_t or '',
    }


def order_data(order):
    items = []
    for item in order.order_items.all():
        product = item.product
        items.append({
            'product_id': item.product_id,
            'name_uz': product.name_uz if product else '—',
            'name_ru': (product.name_ru or product.name_uz) if product else '—',
            'image': product_image_url(product) if product else None,
            'quantity': parse_quantity(item.quantity),
            'price': parse_price(item.price),
            'total': item.get_total(),
        })
    return {
        'id': order.pk,
        'status': order.status,
        'source': order.source,
        'created_at': order.created_at.isoformat(),
        'updated_at': order.updated_at.isoformat(),
        'total': sum(item['total'] for item in items),
        'items': items,
        'customer_name': order.display_name or '',
        'phone': order.phone or '',
        'address': '' if is_coordinates(order.location) else (order.location or ''),
        'lat': order.l_t or '',
        'lng': order.e_t or '',
        'delivery_type': order.delivery_type or '',
        'payment_method': order.payment_method or '',
        'comment': order.comment or '',
    }


def auth_payload(client, created=False):
    return {'token': issue_token(client), 'client': client_data(client), 'created': created}


# ---------------------------------------------------------------------------
# pages
# ---------------------------------------------------------------------------

@xframe_options_exempt  # Telegram Web/Desktop open Mini Apps inside an iframe
def index(request):
    config = {
        'api': reverse('shop:bootstrap').rsplit('bootstrap/', 1)[0],
        'shopName': settings.SHOP_NAME,
        'tagline': settings.SHOP_TAGLINE,
        'supportPhone': settings.SHOP_SUPPORT_PHONE,
        'deliveryTime': settings.SHOP_DELIVERY_TIME,
        'minOrder': settings.SHOP_MIN_ORDER,
    }
    return render(request, 'shop/index.html', {'config': config, 'shop_name': settings.SHOP_NAME})


def product_image(request, pk):
    """Serves images of products that only exist as base64 in the DB (e.g. added before media files)."""
    product = Product.objects.filter(pk=pk).only('img_64').first()
    if not product or not product.img_64:
        raise Http404
    try:
        data = base64.b64decode(product.img_64)
    except ValueError:
        raise Http404
    content_type = 'image/png' if data[:4] == b'\x89PNG' else 'image/webp' if data[8:12] == b'WEBP' else 'image/jpeg'
    response = HttpResponse(data, content_type=content_type)
    response['Cache-Control'] = 'public, max-age=86400'
    return response


# ---------------------------------------------------------------------------
# catalog
# ---------------------------------------------------------------------------

@api()
def bootstrap(request):
    products = list(Product.objects.select_related('measure').order_by('category_id', 'id'))
    category_ids = {product.category_id for product in products if product.category_id}
    categories = [
        {'id': category.pk, 'name_uz': category.name_uz, 'name_ru': category.name_ru or category.name_uz}
        for category in Category.objects.filter(pk__in=category_ids).order_by('id')
    ]
    product_ids = {product.pk for product in products}
    popular = [
        row['product_id'] for row in (
            OrderItem.objects.filter(order__isnull=False, product__isnull=False)
            .exclude(order__status=OrderEnum.new.value)
            .values('product_id').annotate(times=Count('id')).order_by('-times')[:8]
        )
        if row['product_id'] in product_ids
    ]
    client = request.shop_client
    return JsonResponse({
        'categories': categories,
        'products': [product_data(product) for product in products],
        'popular': popular,
        'client': client_data(client) if client else None,
    })


# ---------------------------------------------------------------------------
# auth: Telegram Mini App
# ---------------------------------------------------------------------------

@api(methods=('POST',))
def auth_telegram_webapp(request):
    payload = validate_webapp_init_data(request.data.get('init_data', ''))
    user = (payload or {}).get('user') or {}
    if not user.get('id'):
        return error('invalid_init_data', 401)

    defaults = {
        'first_name': text(user.get('first_name'), 100) or None,
        'last_name': text(user.get('last_name'), 100) or None,
        'tg_nick': text(user.get('username'), 100) or None,
        'lang': 'ru' if user.get('language_code') == 'ru' else 'uz',
    }
    client, created = Client.objects.get_or_create(tg_id=str(user['id']), defaults=defaults)
    if not created:
        changed = []
        for field in ('first_name', 'last_name', 'tg_nick'):
            if defaults[field] and not getattr(client, field):
                setattr(client, field, defaults[field])
                changed.append(field)
        if not client.lang:
            client.lang = defaults['lang']
            changed.append('lang')
        if changed:
            client.save(update_fields=changed + ['updated_at'])
    return JsonResponse(auth_payload(client, created))


# ---------------------------------------------------------------------------
# auth: website "Log in with Telegram" (deep link to the bot + polling)
# ---------------------------------------------------------------------------

@api(methods=('POST',))
def auth_telegram_start(request):
    if rate_limited(f'tg-start:{client_ip(request)}', 30, 3600):
        return error('too_many_requests', 429)
    username = get_bot_username()
    if not username:
        return error('telegram_unavailable', 503)
    login = TelegramLoginToken.objects.create(
        token=secrets.token_urlsafe(24),
        expires_at=timezone.now() + TELEGRAM_LOGIN_TTL,
    )
    return JsonResponse({
        'token': login.token,
        'url': f'https://t.me/{username}?start=login_{login.token}',
        'expires_in': int(TELEGRAM_LOGIN_TTL.total_seconds()),
    })


@api()
def auth_telegram_check(request):
    login = TelegramLoginToken.objects.select_related('client').filter(
        token=request.GET.get('token', '')
    ).first()
    if not login or login.status == LoginTokenStatusEnum.used.value:
        return error('not_found', 404)
    if login.status == LoginTokenStatusEnum.confirmed.value and login.client:
        login.status = LoginTokenStatusEnum.used.value
        login.save(update_fields=['status'])
        return JsonResponse({'status': 'confirmed', **auth_payload(login.client)})
    if login.expires_at < timezone.now():
        return JsonResponse({'status': 'expired'})
    return JsonResponse({'status': 'pending'})


# ---------------------------------------------------------------------------
# auth: phone number + SMS code
# ---------------------------------------------------------------------------

def otp_hash(phone, code):
    return hashlib.sha256(f'{phone}:{code}:{settings.SECRET_KEY}'.encode()).hexdigest()


@api(methods=('POST',))
def auth_phone_request(request):
    phone = normalize_phone(request.data.get('phone'))
    if not phone or not UZ_PHONE_RE.match(phone):
        return error('invalid_phone')

    ip = client_ip(request)
    if rate_limited(f'otp-ip:{ip}', 20, 3600):
        return error('too_many_requests', 429)

    now = timezone.now()
    recent = PhoneOTP.objects.filter(phone=phone, created_at__gte=now - timedelta(hours=1))
    last = recent.order_by('-created_at').first()
    if last and (now - last.created_at).total_seconds() < OTP_RESEND_SECONDS:
        retry_after = OTP_RESEND_SECONDS - int((now - last.created_at).total_seconds())
        return error('too_soon', 429, retry_after=retry_after)
    if recent.count() >= OTP_MAX_PER_HOUR:
        return error('too_many_requests', 429)

    code = f'{secrets.randbelow(900000) + 100000}'
    otp = PhoneOTP.objects.create(phone=phone, code_hash=otp_hash(phone, code), ip=ip, expires_at=now + OTP_TTL)
    try:
        send_code(phone, code)
    except SmsError as exc:
        logger.error('Sign-in code was not sent to %s: %s', phone, exc)
        otp.delete()
        return error('sms_failed', 502)

    response = {'ok': True, 'phone': phone, 'resend_in': OTP_RESEND_SECONDS, 'ttl': int(OTP_TTL.total_seconds())}
    if settings.SHOP_OTP_DEBUG:
        response['debug_code'] = code
    return JsonResponse(response)


def find_client_by_phone(phone):
    """Only numbers confirmed by an SMS code or shared as an own Telegram contact identify a client."""
    last_digits = re.sub(r'\D', '', phone)[-9:]
    clients = Client.objects.annotate(phone_digits=digits_only('phone'), tg_phone_digits=digits_only('tg_phone'))
    return (
        clients.filter(phone_verified_at__isnull=False, phone_digits__endswith=last_digits)
        .order_by('-updated_at').first()
        or clients.filter(tg_phone_digits__endswith=last_digits).order_by('-updated_at').first()
    )


@api(methods=('POST',))
def auth_phone_verify(request):
    phone = normalize_phone(request.data.get('phone'))
    code = re.sub(r'\D', '', str(request.data.get('code', '')))
    if not phone or len(code) != 6:
        return error('invalid_code')

    otp = PhoneOTP.objects.filter(phone=phone, is_used=False, expires_at__gt=timezone.now()).order_by('-created_at').first()
    if not otp:
        return error('code_expired')
    if otp.attempts >= OTP_MAX_ATTEMPTS:
        return error('too_many_attempts', 429)
    if otp.code_hash != otp_hash(phone, code):
        otp.attempts += 1
        otp.save(update_fields=['attempts'])
        return error('invalid_code', attempts_left=max(OTP_MAX_ATTEMPTS - otp.attempts, 0))

    otp.is_used = True
    otp.save(update_fields=['is_used'])

    now = timezone.now()
    client = find_client_by_phone(phone)
    created = client is None
    if created:
        client = Client.objects.create(phone=phone, phone_verified_at=now, lang=pick_lang(request.data.get('lang')))
    else:
        client.phone = phone
        client.phone_verified_at = now
        client.save(update_fields=['phone', 'phone_verified_at', 'updated_at'])
    return JsonResponse(auth_payload(client, created))


# ---------------------------------------------------------------------------
# profile
# ---------------------------------------------------------------------------

@api(methods=('GET', 'PATCH'), auth=True)
def me(request):
    client = request.shop_client
    if request.method == 'PATCH':
        changed = []
        for field in ('first_name', 'last_name'):
            if field in request.data:
                setattr(client, field, text(request.data[field], 100) or None)
                changed.append(field)
        if request.data.get('lang') in LANGS:
            client.lang = request.data['lang']
            changed.append('lang')
        if changed:
            client.save(update_fields=changed + ['updated_at'])
    return JsonResponse({'client': client_data(client)})


# ---------------------------------------------------------------------------
# orders
# ---------------------------------------------------------------------------

def client_orders(client):
    return (
        Order.objects.filter(client=client).exclude(status=OrderEnum.new.value)
        .prefetch_related('order_items__product').order_by('-created_at')
    )


@api(methods=('GET', 'POST'), auth=True)
def orders(request):
    client = request.shop_client
    if request.method == 'GET':
        return JsonResponse({'orders': [order_data(order) for order in client_orders(client)[:50]]})

    data = request.data
    try:
        items = resolve_items(data.get('items'))
    except OrderError as exc:
        return error(exc.code, detail=exc.detail)

    name = text(data.get('name'), 150) or ' '.join(filter(None, [client.first_name, client.last_name]))
    phone = normalize_phone(data.get('phone'))
    delivery_type = data.get('delivery_type') if data.get('delivery_type') in (
        DeliveryTypeEnum.delivery.value, DeliveryTypeEnum.pickup.value) else DeliveryTypeEnum.delivery.value
    address = text(data.get('address'), 255)
    latitude, longitude = data.get('lat'), data.get('lng')
    try:
        latitude = round(float(latitude), 6) if latitude not in (None, '') else None
        longitude = round(float(longitude), 6) if longitude not in (None, '') else None
    except (TypeError, ValueError):
        latitude = longitude = None

    field_errors = {}
    if not name:
        field_errors['name'] = 'required'
    if not phone:
        field_errors['phone'] = 'invalid'
    if delivery_type == DeliveryTypeEnum.delivery.value and not address and latitude is None:
        field_errors['address'] = 'required'
    if field_errors:
        return error('validation', fields=field_errors)

    subtotal = sum(parse_price(product.price) * quantity for product, quantity in items)
    if settings.SHOP_MIN_ORDER and subtotal < settings.SHOP_MIN_ORDER:
        return error('min_order', min_order=settings.SHOP_MIN_ORDER)

    platform = data.get('platform')
    source = platform if platform in (OrderSourceEnum.web.value, OrderSourceEnum.miniapp.value) else OrderSourceEnum.web.value
    payment_method = data.get('payment_method') if data.get('payment_method') in (
        PaymentMethodEnum.cash.value, PaymentMethodEnum.card.value) else PaymentMethodEnum.cash.value

    if rate_limited(f'order:{client.pk}', 10, 600):
        return error('too_many_requests', 429)

    order = create_order(
        items=items,
        source=source,
        status=OrderEnum.ordered.value,
        client=client,
        customer_name=name,
        phone=phone,
        address=address if delivery_type == DeliveryTypeEnum.delivery.value else '',
        latitude=latitude if delivery_type == DeliveryTypeEnum.delivery.value else None,
        longitude=longitude if delivery_type == DeliveryTypeEnum.delivery.value else None,
        delivery_type=delivery_type,
        payment_method=payment_method,
        comment=text(data.get('comment'), 1000),
    )

    # Remember contact details for the next order (the bot does the same).
    changed = []
    if not client.first_name and name:
        client.first_name = name.split(' ')[0][:100]
        changed.append('first_name')
    if not client.phone:
        client.phone = phone
        changed.append('phone')
    if delivery_type == DeliveryTypeEnum.delivery.value:
        client.location = address or f'{latitude} {longitude}'
        client.l_t = str(latitude) if latitude is not None else None
        client.e_t = str(longitude) if longitude is not None else None
        changed += ['location', 'l_t', 'e_t']
    if data.get('lang') in LANGS and client.lang != data['lang']:
        client.lang = data['lang']
        changed.append('lang')
    if changed:
        client.save(update_fields=changed + ['updated_at'])

    notify_new_order(order)
    order = client_orders(client).get(pk=order.pk)
    return JsonResponse({'order': order_data(order)}, status=201)


@api(auth=True)
def order_detail(request, pk):
    order = client_orders(request.shop_client).filter(pk=pk).first()
    if not order:
        return error('not_found', 404)
    return JsonResponse({'order': order_data(order)})
