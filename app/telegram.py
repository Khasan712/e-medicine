"""Small Telegram Bot API helpers used by the Django side (the bot itself runs in its own container)."""
import logging
import threading
from html import escape

import requests
from django.conf import settings
from django.core.cache import cache
from django.db import connections, transaction

from app.utils import format_money

logger = logging.getLogger('shop')

API_URL = 'https://api.telegram.org/bot{token}/{method}'


def call_bot_api(method, payload=None, timeout=6):
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        return None
    try:
        response = requests.post(API_URL.format(token=token, method=method), json=payload or {}, timeout=timeout)
        data = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning('Telegram %s failed: %s', method, exc)
        return None
    if not data.get('ok'):
        logger.warning('Telegram %s error: %s', method, data.get('description'))
        return None
    return data.get('result')


def get_bot_username():
    if settings.TELEGRAM_BOT_USERNAME:
        return settings.TELEGRAM_BOT_USERNAME.lstrip('@')
    username = cache.get('telegram_bot_username')
    if username is None:
        result = call_bot_api('getMe') or {}
        username = result.get('username') or ''
        cache.set('telegram_bot_username', username, 60 * 60 * 24 if username else 60)
    return username or None


def send_message(chat_id, text):
    return call_bot_api('sendMessage', {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'})


ORDER_TEXTS = {
    'uz': {
        'client_title': '✅ <b>Buyurtmangiz qabul qilindi!</b>',
        'client_footer': 'Tez orada siz bilan bog‘lanamiz. Rahmat! 😊',
        'admin_title': '🆕 <b>Yangi buyurtma</b>',
        'total': 'Jami',
        'currency': 'so‘m',
    },
    'ru': {
        'client_title': '✅ <b>Ваш заказ принят!</b>',
        'client_footer': 'Скоро мы с вами свяжемся. Спасибо! 😊',
        'admin_title': '🆕 <b>Новый заказ</b>',
        'total': 'Итого',
        'currency': 'сум',
    },
}
SOURCE_LABELS = {'web': 'Web', 'miniapp': 'Mini App', 'bot': 'Bot', 'admin': 'Admin'}


def _order_lines(order, lang):
    texts = ORDER_TEXTS[lang]
    lines = []
    for item in order.order_items.select_related('product'):
        name = getattr(item.product, f'name_{lang}', None) or getattr(item.product, 'name_uz', '—')
        lines.append(f'• {escape(name)} × {item.quantity} = {format_money(item.get_total())} {texts["currency"]}')
    lines.append(f'\n💵 <b>{texts["total"]}: {format_money(order.get_total())} {texts["currency"]}</b>')
    return lines


def _notify_new_order(order_id):
    from app.models import Order  # avoid import cycle at module load

    order = Order.objects.select_related('client').filter(pk=order_id).first()
    if not order:
        return

    client = order.client
    if client and client.tg_id:
        lang = client.lang if client.lang in ORDER_TEXTS else 'uz'
        texts = ORDER_TEXTS[lang]
        body = [texts['client_title'], f'🧾 #{order.id}', ''] + _order_lines(order, lang) + ['', texts['client_footer']]
        send_message(client.tg_id, '\n'.join(body))

    if settings.ORDERS_NOTIFY_CHAT_ID:
        texts = ORDER_TEXTS['uz']
        body = [f'{texts["admin_title"]} #{order.id} · {SOURCE_LABELS.get(order.source, order.source)}']
        if order.display_name:
            body.append(f'👤 {escape(order.display_name)}')
        if order.phone:
            body.append(f'📞 {escape(order.phone)}')
        if order.location:
            body.append(f'📍 {escape(order.location)}')
        if order.comment:
            body.append(f'💬 {escape(order.comment)}')
        body += [''] + _order_lines(order, 'uz')
        send_message(settings.ORDERS_NOTIFY_CHAT_ID, '\n'.join(body))


def _notify_in_thread(order_id):
    try:
        _notify_new_order(order_id)
    except Exception:  # a notification must never take anything down
        logger.exception('Order notification failed')
    finally:
        connections.close_all()


def notify_new_order(order):
    """Fire-and-forget: never slows down or breaks order creation."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return
    transaction.on_commit(
        lambda: threading.Thread(target=_notify_in_thread, args=(order.pk,), daemon=True).start()
    )
