from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django_tenants.middleware.main import TenantMainMiddleware
from django_tenants.utils import get_public_schema_name

from .models import Domain

HEALTH_PATH = '/healthz'


class BusinessMiddleware(TenantMainMiddleware):
    """Picks the business (its PostgreSQL schema) by the host and the API by the domain kind:
    <slug>.<domain> — shop API, <slug>-admin.<domain> — admin API, the platform domain — platform API.
    Must be the first middleware."""

    def process_request(self, request):
        connection.set_schema_to_public()
        if request.path == HEALTH_PATH:  # for the container healthcheck: any host, no business
            connection.ensure_connection()
            return JsonResponse({'status': 'ok'})
        hostname = self.hostname_from_request(request).lower()
        domain = Domain.objects.select_related('tenant').filter(domain=hostname).first()
        if domain is None:
            return JsonResponse({'error': 'unknown_host'}, status=404)

        business = domain.tenant
        business.domain_url = hostname
        request.tenant = business
        request.domain_kind = domain.kind
        connection.set_tenant(business)

        if business.schema_name == get_public_schema_name():
            request.urlconf = settings.PUBLIC_SCHEMA_URLCONF
            return None
        if not business.is_active:
            return JsonResponse({'error': 'business_suspended'}, status=503)
        request.urlconf = settings.SHOP_URLCONF if domain.kind == Domain.KIND_SHOP else settings.ROOT_URLCONF
        return None
