from django import template
from dashboard.translations import TRANSLATIONS, get_translation

register = template.Library()


@register.simple_tag(takes_context=True)
def t(context, key):
    """Get translation for key based on current language stored in session"""
    request = context.get('request')
    lang = 'uz'  # Default language
    if request:
        lang = request.session.get('dashboard_lang', 'uz')
    return get_translation(key, lang)


@register.simple_tag(takes_context=True)
def get_current_lang(context):
    """Get current language code from session"""
    request = context.get('request')
    if request:
        return request.session.get('dashboard_lang', 'uz')
    return 'uz'


@register.simple_tag(takes_context=True)
def get_current_theme(context):
    """Get current theme from session (light or dark)"""
    request = context.get('request')
    if request:
        return request.session.get('dashboard_theme', 'dark')
    return 'dark'


@register.simple_tag(takes_context=True)
def is_active_nav(context, url_name):
    """Check if current URL matches the nav item"""
    request = context.get('request')
    if not request or not request.resolver_match:
        return False

    current_url = request.resolver_match.url_name or ''

    # Extract the base name from url_name (e.g., 'dashboard:orders_list' -> 'orders')
    if ':' in url_name:
        nav_base = url_name.split(':')[1]
    else:
        nav_base = url_name

    # Remove _list suffix
    nav_base = nav_base.replace('_list', '')

    # Define section mappings (handle both singular and plural URL names)
    section_mappings = {
        'sales_pos': ['sales'],
        'orders': ['orders', 'order'],
        'clients': ['clients', 'client'],
        'products': ['products', 'product'],
        'categories': ['categories', 'category'],
        'users': ['users', 'user'],
        'dashboard': ['dashboard'],
    }

    # Get the prefixes to check for this nav item
    prefixes = section_mappings.get(nav_base, [nav_base])

    # Check if current URL starts with any of the prefixes
    for prefix in prefixes:
        if current_url.startswith(prefix):
            return True

    return False


@register.filter
def status_class(status):
    """Return CSS class for order status"""
    status_classes = {
        'new': 'status-new',
        'ordered': 'status-ordered',
        'on_the_way': 'status-on_the_way',
        'completed': 'status-completed',
        'rejected': 'status-rejected',
    }
    return status_classes.get(status, 'bg-gray-100 text-gray-800')


@register.simple_tag(takes_context=True)
def status_label(context, status):
    """Return human-readable label for order status based on current language"""
    request = context.get('request')
    lang = 'uz'
    if request:
        lang = request.session.get('dashboard_lang', 'uz')

    status_labels = {
        'new': {'uz': 'Yangi', 'ru': 'Новый'},
        'ordered': {'uz': 'Buyurtma qilingan', 'ru': 'Заказано'},
        'on_the_way': {'uz': "Yo'lda", 'ru': 'В пути'},
        'completed': {'uz': 'Bajarilgan', 'ru': 'Выполнено'},
        'rejected': {'uz': 'Bekor qilingan', 'ru': 'Отменено'},
    }

    if status in status_labels:
        return status_labels[status].get(lang, status_labels[status].get('uz', status))
    return status


@register.filter
def format_price(price):
    """Format price string for display"""
    if price:
        try:
            # Remove any existing formatting
            clean_price = str(price).replace(' ', '').replace('UZS', '').replace('sum', '').replace('сум', '').strip()
            # Convert to integer and format with spaces
            num = int(clean_price)
            formatted = '{:,}'.format(num).replace(',', ' ')
            return f"{formatted} UZS"
        except (ValueError, AttributeError):
            return price
    return '0 UZS'


@register.simple_tag
def get_order_total(order):
    """Calculate total price for an order (price * quantity for each item)"""
    total = 0
    for item in order.order_items.all():
        if item.price:
            try:
                price_str = str(item.price).replace(' ', '').replace('UZS', '').replace('сум', '').strip()
                price = int(price_str)
                # Get quantity, default to 1 if not set
                quantity = int(item.quantity) if item.quantity else 1
                total += price * quantity
            except (ValueError, AttributeError):
                pass
    return '{:,}'.format(total).replace(',', ' ') + ' UZS'


@register.filter
def item_subtotal(item):
    """Calculate subtotal for an order item (price * quantity)"""
    if item.price:
        try:
            price_str = str(item.price).replace(' ', '').replace('UZS', '').replace('сум', '').strip()
            price = int(price_str)
            quantity = int(item.quantity) if item.quantity else 1
            subtotal = price * quantity
            return '{:,}'.format(subtotal).replace(',', ' ') + ' UZS'
        except (ValueError, AttributeError):
            return item.price
    return '0 UZS'


SOURCE_CLASSES = {
    'bot': 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    'web': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    'miniapp': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    'admin': 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
}


@register.filter
def source_class(source):
    """Badge colors for the order source (bot / web / miniapp / admin)."""
    return SOURCE_CLASSES.get(source, 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300')


@register.simple_tag(takes_context=True)
def source_label(context, source):
    request = context.get('request')
    lang = request.session.get('dashboard_lang', 'uz') if request else 'uz'
    return get_translation(f'source_{source}', lang) if source else '-'


@register.simple_tag(takes_context=True)
def localized_name(context, obj):
    """Get localized name for objects with name_uz and name_ru fields"""
    request = context.get('request')
    lang = 'uz'
    if request:
        lang = request.session.get('dashboard_lang', 'uz')

    if lang == 'ru':
        return getattr(obj, 'name_ru', '') or getattr(obj, 'name_uz', '')
    return getattr(obj, 'name_uz', '') or getattr(obj, 'name_ru', '')
