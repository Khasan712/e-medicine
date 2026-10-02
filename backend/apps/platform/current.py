"""The business whose schema is active — in a request (hub.middleware) or in a bot (tenant_context) —
its bots and the addresses of its parts."""
from django.conf import settings
from django.db import connection
from django_tenants.utils import get_public_schema_name

from .models import Business, BusinessBot, Domain


def current_business():
    tenant = getattr(connection, 'tenant', None)
    if tenant is None or tenant.schema_name == get_public_schema_name():
        return None
    if isinstance(tenant, Business):
        return tenant
    # schema_context() activates a stand-in object that only knows the schema name.
    return Business.objects.filter(schema_name=tenant.schema_name).first()


def business_bot(role, business=None):
    business = business or current_business()
    if business is None:
        return None
    return BusinessBot.objects.filter(business=business, role=role, is_active=True).first()


def bot_token(role, business=None):
    bot = business_bot(role, business)
    return bot.token if bot else ''


def subdomain(business, kind):
    return business.slug if kind == Domain.KIND_SHOP else f'{business.slug}-admin'


def public_url(business, kind):
    """https://<slug>.<PLATFORM_DOMAIN>/ — the address customers and Telegram (Mini Apps) use."""
    return f'https://{subdomain(business, kind)}.{settings.PLATFORM_DOMAIN}/'


def url_for(request, business, kind):
    """The address of a part of the business in the style of the current request: local
    (<sub>.localhost:<port>) when the page itself is opened locally, otherwise public."""
    name, _, port = (request.get_host() if request else '').partition(':')
    local = settings.PLATFORM_LOCAL_DOMAIN
    if name == local or name.endswith('.' + local):
        return f'http://{subdomain(business, kind)}.{local}{":" + port if port else ""}/'
    return public_url(business, kind)
