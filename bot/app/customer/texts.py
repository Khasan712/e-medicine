"""The customers' bot (uz / ru): its own messages and the messages about orders (sent through the outbox)."""
from html import escape

from app.utils import format_money

LANGUAGES = ('uz', 'ru')

TEXTS = {
    'uz': {
        'welcome': ("👋 <b>{name}</b>ga xush kelibsiz!\n\n"
                    "Menyuni ko'rish va buyurtma berish uchun «🛍 Do'kon» tugmasini bosing."),
        'hint': "🛍 Buyurtma berish uchun «Do'kon»ni oching.",
        'btn_shop': "🛍 Do'kon",
        'login_ok': '✅ Tasdiqlandi! Saytga qayting — hisobingizga avtomatik kirasiz.',
        'login_invalid': "⌛️ Havola eskirgan yoki allaqachon ishlatilgan. Saytda «Telegram orqali kirish»ni qayta bosing.",
        'lang_choose': '🌐 Tilni tanlang / Выберите язык',
        'lang_saved': "✅ Til: O'zbekcha",
        'cmd_start': 'Boshlash',
        'cmd_lang': 'Til / Язык',
        'description': "{name}: menyu, buyurtma va yetkazib berish — «🛍 Do'kon» tugmasi orqali.",
        'short_description': "{name} — onlayn buyurtma",
    },
    'ru': {
        'welcome': ('👋 Добро пожаловать в <b>{name}</b>!\n\n'
                    'Чтобы посмотреть меню и сделать заказ, нажмите «🛍 Магазин».'),
        'hint': '🛍 Чтобы сделать заказ, откройте «Магазин».',
        'btn_shop': '🛍 Магазин',
        'login_ok': '✅ Подтверждено! Вернитесь на сайт — вход выполнится автоматически.',
        'login_invalid': '⌛️ Ссылка устарела или уже использована. Нажмите «Войти через Telegram» на сайте ещё раз.',
        'lang_choose': '🌐 Tilni tanlang / Выберите язык',
        'lang_saved': '✅ Язык: русский',
        'cmd_start': 'Начать',
        'cmd_lang': 'Язык / Til',
        'description': '{name}: меню, заказ и доставка — через кнопку «🛍 Магазин».',
        'short_description': '{name} — онлайн-заказ',
    },
}


def t(lang, key, **kwargs):
    text = TEXTS.get(lang, TEXTS['uz'])[key]
    return text.format(**kwargs) if kwargs else text


def language_of(telegram_user):
    code = getattr(telegram_user, 'language_code', None) or ''
    return 'ru' if code.startswith('ru') else 'uz'


# ---------------------------------------------------------------------------
# messages about orders (outbox)
# ---------------------------------------------------------------------------

ORDER_TEXTS = {
    'uz': {
        'client_title': '✅ <b>Buyurtmangiz qabul qilindi!</b>',
        'client_footer': 'Tez orada siz bilan bog‘lanamiz. Rahmat! 😊',
        'total': 'Jami',
        'currency': 'so‘m',
    },
    'ru': {
        'client_title': '✅ <b>Ваш заказ принят!</b>',
        'client_footer': 'Скоро мы с вами свяжемся. Спасибо! 😊',
        'total': 'Итого',
        'currency': 'сум',
    },
}

STATUS_TEXTS = {
    'uz': {
        'accepted': '👨‍🍳 Buyurtmangiz #{id} qabul qilindi va tayyorlanmoqda!',
        'on_the_way': '🚚 Buyurtmangiz #{id} yo‘lda! Tez orada yetkazamiz.',
        'completed': '✅ Buyurtmangiz #{id} yetkazildi. Yoqimli ishtaha! 😋',
        'completed_pickup': '✅ Buyurtmangiz #{id} topshirildi. Yoqimli ishtaha! 😋',
        'rejected': '😔 Afsuski, buyurtmangiz #{id} bekor qilindi. Savollar bo‘lsa, biz bilan bog‘laning.',
    },
    'ru': {
        'accepted': '👨‍🍳 Ваш заказ #{id} принят и уже готовится!',
        'on_the_way': '🚚 Ваш заказ #{id} в пути! Скоро будем.',
        'completed': '✅ Ваш заказ #{id} доставлен. Приятного аппетита! 😋',
        'completed_pickup': '✅ Ваш заказ #{id} выдан. Приятного аппетита! 😋',
        'rejected': '😔 К сожалению, ваш заказ #{id} отменён. Если есть вопросы — свяжитесь с нами.',
    },
}
STATUS_EVENTS = ('accepted', 'on_the_way', 'completed', 'rejected')


def order_language(client):
    return client.lang if client and client.lang in ORDER_TEXTS else 'uz'


def order_created_text(order, lang):
    """`order` is an orders.OrderView."""
    texts = ORDER_TEXTS[lang]
    lines = [texts['client_title'], f'🧾 #{order.id}', '']
    for line in order.lines:
        product = line.product
        name = (getattr(product, f'name_{lang}', None) or getattr(product, 'name_uz', None) or '—') if product else '—'
        lines.append(f'• {escape(name)} × {line.quantity} = {format_money(line.total)} {texts["currency"]}')
    lines.append(f'\n💵 <b>{texts["total"]}: {format_money(order.total)} {texts["currency"]}</b>')
    return '\n'.join(lines + ['', texts['client_footer']])


def order_status_text(order, event, lang, support_phone=''):
    key = 'completed_pickup' if event == 'completed' and order.delivery_type == 'pickup' else event
    text = STATUS_TEXTS[lang][key].format(id=order.id)
    if event == 'rejected' and support_phone:
        text += f'\n☎️ {escape(support_phone)}'
    return text
