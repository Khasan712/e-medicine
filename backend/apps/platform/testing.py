"""Base test case: tests run inside a test business (its own schema, created once per test run)."""
from django.core.cache import cache
from django.db import connection
from django.test import modify_settings, override_settings
from django_tenants.test.cases import FastTenantTestCase
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework.test import APIClient

from .models import BusinessBot, Domain

SHOP_HOST = 'shop.test'
ADMIN_HOST = 'admin.test'
PLATFORM_HOST = 'hub.localhost'


class BusinessClient(APIClient):
    """An API client for one host. After every request the test is back in the schema of the test business
    (a request switches the connection to the schema of its host)."""

    def __init__(self, tenant, host, **defaults):
        super().__init__(HTTP_HOST=host, **defaults)
        self.tenant = tenant

    def request(self, *args, **kwargs):
        try:
            return super().request(*args, **kwargs)
        finally:
            connection.set_tenant(self.tenant)


class BusinessTestCase(FastTenantTestCase):
    """`self.client` talks to the business's admin API (ADMIN_HOST), `self.shop` to its shop API (SHOP_HOST);
    ORM calls in a test run in the business schema."""

    @classmethod
    def get_test_schema_name(cls):
        return 'test_business'

    @classmethod
    def get_test_tenant_domain(cls):
        return SHOP_HOST

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.name = 'Test Shop'
        tenant.slug = 'test-shop'

    @classmethod
    def setup_domain(cls, domain):
        domain.kind = Domain.KIND_SHOP

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # FastTenantTestCase skips TestCase.setUpClass, which applies class-level @override_settings.
        if cls._overridden_settings:
            cls.enterClassContext(override_settings(**cls._overridden_settings))
        if cls._modified_settings:
            cls.enterClassContext(modify_settings(cls._modified_settings))

    @classmethod
    def use_new_tenant(cls):
        Domain.objects.get_or_create(
            domain=ADMIN_HOST, defaults={'tenant': cls.tenant, 'kind': Domain.KIND_ADMIN, 'is_primary': False})

    def setUp(self):
        super().setUp()
        cache.clear()  # rate limits and cached lookups must not leak from one test into another
        self.client = self.make_client(ADMIN_HOST)
        self.shop = self.make_client(SHOP_HOST)

    def tearDown(self):
        connection.set_tenant(self.tenant)
        super().tearDown()

    def make_client(self, host, **defaults):
        return BusinessClient(self.tenant, host, **defaults)

    def platform_client(self, **defaults):
        """A client of our platform API; makes sure the platform and its domains exist."""
        from .provisioning import ensure_platform

        with schema_context(get_public_schema_name()):
            ensure_platform()
        return self.make_client(PLATFORM_HOST, **defaults)

    def add_bot(self, role, token='123456:TEST-TOKEN-client-bot-000000000000', username='test_bot', telegram_id=1001):
        bot = BusinessBot(business=self.tenant, role=role, telegram_id=telegram_id, username=username)
        bot.token = token
        bot.save()
        return bot
