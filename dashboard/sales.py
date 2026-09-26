"""Dashboard "Sales" section: staff create orders by hand or by voice (no client record required)."""
import json

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from app.enums import DeliveryTypeEnum, OrderEnum, OrderSourceEnum
from app.models import Category, Order, Product
from app.services import OrderError, create_order, resolve_items
from app.utils import normalize_phone, parse_price, parse_quantity
from shop.views import product_image_url
from . import voice

SALE_STATUSES = (OrderEnum.ordered.value, OrderEnum.on_the_way.value, OrderEnum.completed.value)
MAX_AUDIO_BYTES = 10 * 1024 * 1024


def _lang(request):
    return request.session.get('dashboard_lang', 'uz')


def _catalog_products():
    return Product.objects.select_related('measure').order_by('category_id', 'id')


def _sale_data(order):
    return {
        'id': order.pk,
        'url': reverse('dashboard:order_detail', args=[order.pk]),
        'name': order.display_name or '',
        'phone': order.phone or '',
        'status': order.status,
        'total': order.get_total(),
        'items_count': sum(parse_quantity(item.quantity) for item in order.order_items.all()),
        'created_at': timezone.localtime(order.created_at).strftime('%H:%M'),
        'date': timezone.localtime(order.created_at).strftime('%d.%m.%Y'),
    }


def _today_stats():
    today = timezone.localdate()
    sales = list(
        Order.objects.filter(source=OrderSourceEnum.admin.value, created_at__date=today)
        .exclude(status=OrderEnum.rejected.value).prefetch_related('order_items')
    )
    revenue = sum(order.get_total() for order in sales)
    return {
        'count': len(sales),
        'revenue': revenue,
        'average': revenue // len(sales) if sales else 0,
        'all_orders_today': Order.objects.filter(created_at__date=today).exclude(status=OrderEnum.new.value).count(),
    }


@login_required(login_url='dashboard:login')
def sales_pos(request):
    products = list(_catalog_products())
    category_ids = {product.category_id for product in products if product.category_id}
    categories = Category.objects.filter(pk__in=category_ids).order_by('id')
    recent = (
        Order.objects.filter(source=OrderSourceEnum.admin.value)
        .prefetch_related('order_items').select_related('client').order_by('-created_at')[:8]
    )
    config = {
        'lang': _lang(request),
        'csrfToken': None,  # filled in the template
        'urls': {
            'create': reverse('dashboard:sales_create'),
            'voiceToken': reverse('dashboard:sales_voice_token'),
            'voiceParse': reverse('dashboard:sales_voice_parse'),
        },
        'voice': {
            'gemini': voice.is_configured(),
            'live': voice.is_configured() and settings.GEMINI_LIVE_ENABLED,
        },
        'categories': [
            {'id': category.pk, 'name_uz': category.name_uz, 'name_ru': category.name_ru or category.name_uz}
            for category in categories
        ],
        'products': [
            {
                'id': product.pk,
                'name_uz': product.name_uz,
                'name_ru': product.name_ru or product.name_uz,
                'price': parse_price(product.price),
                'unit_uz': product.measure.name_uz if product.measure else '',
                'unit_ru': product.measure.name_ru if product.measure else '',
                'category_id': product.category_id,
                'image': product_image_url(product),
            }
            for product in products
        ],
        'recent': [_sale_data(order) for order in recent],
        'stats': _today_stats(),
    }
    return render(request, 'dashboard/sales/pos.html', {'sales_config': config})


def _json_body(request):
    try:
        data = json.loads(request.body or b'{}')
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


@login_required(login_url='dashboard:login')
@require_POST
def sales_create(request):
    data = _json_body(request)
    if data is None:
        return JsonResponse({'error': 'invalid_json'}, status=400)
    try:
        items = resolve_items(data.get('items'))
    except OrderError as exc:
        return JsonResponse({'error': exc.code, 'detail': exc.detail}, status=400)

    delivery_type = data.get('delivery_type')
    if delivery_type not in (DeliveryTypeEnum.delivery.value, DeliveryTypeEnum.pickup.value):
        delivery_type = DeliveryTypeEnum.pickup.value
    status = data.get('status')
    if status not in SALE_STATUSES:
        status = OrderEnum.completed.value if delivery_type == DeliveryTypeEnum.pickup.value else OrderEnum.ordered.value

    raw_phone = str(data.get('phone') or '').strip()
    order = create_order(
        items=items,
        source=OrderSourceEnum.admin.value,
        status=status,
        client=None,  # a sale from the dashboard does not need a client record
        created_by=request.user,
        customer_name=data.get('customer_name'),
        phone=(normalize_phone(raw_phone) or raw_phone) if raw_phone else None,
        address=data.get('address') if delivery_type == DeliveryTypeEnum.delivery.value else None,
        delivery_type=delivery_type,
        payment_method=data.get('payment_method'),
        comment=data.get('comment'),
    )
    order = Order.objects.prefetch_related('order_items').get(pk=order.pk)
    return JsonResponse({'order': _sale_data(order), 'stats': _today_stats()}, status=201)


@login_required(login_url='dashboard:login')
@require_POST
def sales_voice_token(request):
    if not voice.is_configured():
        return JsonResponse({'error': 'not_configured'}, status=400)
    try:
        session = voice.create_live_session(voice.build_catalog(_catalog_products()))
    except voice.VoiceError as exc:
        return JsonResponse({'error': exc.code}, status=502)
    return JsonResponse(session)


@login_required(login_url='dashboard:login')
@require_POST
def sales_voice_parse(request):
    """Text (typed or live transcript) or an audio clip -> complete updated order form."""
    audio = request.FILES.get('audio')
    if audio:
        if audio.size > MAX_AUDIO_BYTES:
            return JsonResponse({'error': 'audio_too_large'}, status=400)
        try:
            state = json.loads(request.POST.get('state') or '{}')
        except ValueError:
            state = {}
        text, audio_bytes, mime_type = request.POST.get('text', ''), audio.read(), audio.content_type
        live_text = request.POST.get('live_text', '')
    else:
        data = _json_body(request)
        if data is None:
            return JsonResponse({'error': 'invalid_json'}, status=400)
        state, text, audio_bytes, mime_type = data.get('state') or {}, data.get('text', ''), None, None
        live_text = ''

    if not str(text or '').strip() and not audio_bytes:
        return JsonResponse({'error': 'empty'}, status=400)

    catalog = voice.build_catalog(_catalog_products())
    try:
        result, engine = voice.understand(catalog, state, text=text, audio=audio_bytes, mime_type=mime_type,
                                          lang=_lang(request), live_text=live_text)
    except voice.VoiceError as exc:
        status = 400 if exc.code in ('not_configured', 'empty_transcript') else 502
        return JsonResponse({'error': exc.code}, status=status)
    return JsonResponse({'result': result, 'engine': engine})
