"""Opening a business on the platform: its schema, domains and owner account."""
import logging
import re

from django.conf import settings
from django_tenants.utils import get_public_schema_name, tenant_context

from .models import Business, Domain

logger = logging.getLogger('platform')

SLUG_RE = re.compile(r'^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$')
RESERVED_SLUGS = {'www', 'admin', 'api', 'hub', 'mail', 'static', 'media', 'public', 'app', 'bot', 'portex', 'test',
                  'check-slug', 'platform', 'deliveryhub'}


class ProvisioningError(ValueError):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def schema_for(slug):
    return slug.replace('-', '_')


def validate_slug(slug):
    if not (3 <= len(slug) <= 30) or not SLUG_RE.match(slug):
        raise ProvisioningError('slug_invalid')
    reserved = RESERVED_SLUGS | {settings.PLATFORM_HUB_SUBDOMAIN, *settings.PLATFORM_RESERVED_SUBDOMAINS}
    if slug in reserved or slug.endswith('-admin'):
        raise ProvisioningError('slug_reserved')
    if Business.objects.filter(slug=slug).exists() or Business.objects.filter(schema_name=schema_for(slug)).exists():
        raise ProvisioningError('slug_taken')


def domains_for(business):
    """(host, kind) pairs of a business: public addresses and their local twins (*.localhost)."""
    pairs = []
    for suffix in (settings.PLATFORM_DOMAIN, settings.PLATFORM_LOCAL_DOMAIN):
        pairs += [(f'{business.slug}.{suffix}', Domain.KIND_SHOP),
                  (f'{business.slug}-admin.{suffix}', Domain.KIND_ADMIN)]
    return pairs


def ensure_platform():
    """The public schema as a Business with the domains of our panel (safe to call again)."""
    platform, _ = Business.objects.get_or_create(
        schema_name=get_public_schema_name(),
        defaults={'name': 'DeliveryHub', 'slug': settings.PLATFORM_HUB_SUBDOMAIN},
    )
    hosts = [f'{settings.PLATFORM_HUB_SUBDOMAIN}.{settings.PLATFORM_DOMAIN}',
             f'hub.{settings.PLATFORM_LOCAL_DOMAIN}', settings.PLATFORM_LOCAL_DOMAIN]
    for host in hosts:
        Domain.objects.get_or_create(domain=host, defaults={'tenant': platform, 'kind': Domain.KIND_PLATFORM})
    return platform


def add_domains(business):
    for host, kind in domains_for(business):
        Domain.objects.get_or_create(domain=host, defaults={'tenant': business, 'kind': kind})


def create_business(*, name, slug, owner_name, owner_phone, owner_password, **profile):
    """Creates the schema (runs the migrations of TENANT_APPS — a few seconds), the domains and the owner's
    admin account. Raises ProvisioningError for a bad or taken slug."""
    from apps.core.models import Descriptions, User

    validate_slug(slug)
    ensure_platform()
    business = Business(schema_name=schema_for(slug), name=name, slug=slug,
                        owner_name=owner_name, owner_phone=owner_phone, **profile)
    business.save(verbosity=0)
    try:
        add_domains(business)
        with tenant_context(business):
            User.objects.create_user(phone_number=owner_phone, role='admin', password=owner_password,
                                     first_name=owner_name)
            Descriptions.objects.get_or_create(name_uz='dona', defaults={'name_ru': 'шт'})
    except Exception:
        business.delete(force_drop=True)
        raise
    write_tunnels_file()
    logger.info('Business %s (%s) created', business.name, business.slug)
    return business


def tunnel_subdomains():
    subdomains = [settings.PLATFORM_HUB_SUBDOMAIN]
    for business in Business.objects.exclude(schema_name=get_public_schema_name()).order_by('created_at'):
        if business.is_active:
            subdomains += [business.slug, f'{business.slug}-admin']
    return subdomains


def write_tunnels_file():
    """Optional (TUNNELS_FILE): a tunnel supervisor on the host (portex) keeps exactly these subdomains open."""
    path = settings.TUNNELS_FILE
    if not path:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text('\n'.join(tunnel_subdomains()) + '\n')
    temporary.replace(path)
