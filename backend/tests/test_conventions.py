"""The rules every API follows (docs/api.md, Conventions): hosts, error shape, pagination, schema."""
from django.test import Client as DjangoClient

from apps.core.models import Order, User
from apps.platform.models import Business
from apps.platform.testing import ADMIN_HOST, SHOP_HOST, BusinessTestCase


class HostTests(BusinessTestCase):
    def test_unknown_host(self):
        response = DjangoClient(HTTP_HOST='nobody.example.uz').get('/api/v1/shop')
        self.assertEqual((response.status_code, response.json()), (404, {'error': 'unknown_host'}))

    def test_suspended_business_answers_503_everywhere(self):
        Business.objects.filter(pk=self.tenant.pk).update(status=Business.STATUS_SUSPENDED)
        for client, path in ((self.shop, '/api/v1/shop'), (self.client, '/api/v1/auth/me')):
            response = client.get(path)
            self.assertEqual((response.status_code, response.json()), (503, {'error': 'business_suspended'}))

    def test_each_host_has_its_own_api(self):
        self.assertEqual(self.shop.get('/api/v1/shop').status_code, 200)
        self.assertEqual(self.client.get('/api/v1/shop').status_code, 404)  # the admin host has no shop API
        self.assertEqual(self.shop.get('/api/v1/dashboard').status_code, 404)

    def test_health_check_answers_on_any_host(self):
        response = DjangoClient(HTTP_HOST='anything.invalid').get('/healthz')
        self.assertEqual((response.status_code, response.json()), (200, {'status': 'ok'}))

    def test_hosts_are_case_insensitive_and_ignore_the_port(self):
        self.assertEqual(self.make_client(f'{SHOP_HOST.upper()}:8100').get('/api/v1/shop').status_code, 200)


class ErrorShapeTests(BusinessTestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(phone_number='+998900000001', role='admin', password='pass-12345')

    def test_unknown_path(self):
        response = self.client.get('/api/v1/nothing-here')
        self.assertEqual((response.status_code, response.json()), (404, {'error': 'not_found'}))

    def test_auth_required(self):
        response = self.client.get('/api/v1/dashboard')
        self.assertEqual((response.status_code, response.json()), (401, {'error': 'auth_required'}))

    def test_method_not_allowed(self):
        self.client.force_login(self.user)
        response = self.client.delete('/api/v1/dashboard')
        self.assertEqual((response.status_code, response.json()), (405, {'error': 'method_not_allowed'}))

    def test_validation(self):
        self.client.force_login(self.user)
        response = self.client.post('/api/v1/categories', {'name_uz': ''}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {'error': 'validation',
                                           'fields': {'name_uz': ['blank'], 'name_ru': ['required']}})

    def test_invalid_json(self):
        self.client.force_login(self.user)
        response = self.client.post('/api/v1/categories', '{not json', content_type='application/json')
        self.assertEqual((response.status_code, response.json()), (400, {'error': 'invalid_json'}))

    def test_not_found_object(self):
        self.client.force_login(self.user)
        response = self.client.get('/api/v1/orders/424242')
        self.assertEqual((response.status_code, response.json()), (404, {'error': 'not_found'}))


class PaginationTests(BusinessTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_login(User.objects.create_user(phone_number='+998900000001', role='admin',
                                                         password='pass-12345'))
        Order.objects.bulk_create([Order(status='ordered', source='web') for _ in range(25)])

    def test_pages(self):
        first = self.client.get('/api/v1/orders').json()
        self.assertEqual((first['count'], first['page'], first['pages'], len(first['results'])), (25, 1, 2, 20))
        last = self.client.get('/api/v1/orders?page=2').json()
        self.assertEqual((last['page'], len(last['results'])), (2, 5))

    def test_page_size_and_out_of_range(self):
        body = self.client.get('/api/v1/orders?page_size=10&page=99').json()
        self.assertEqual((body['page'], body['pages'], len(body['results'])), (3, 3, 5))
        self.assertEqual(len(self.client.get('/api/v1/orders?page_size=1000').json()['results']), 25)


class SchemaTests(BusinessTestCase):
    def test_every_api_publishes_its_openapi_schema(self):
        for client in (self.shop, self.client, self.platform_client()):
            response = client.get('/api/v1/schema/', HTTP_ACCEPT='application/vnd.oai.openapi+json')
            self.assertEqual(response.status_code, 200, response.content[:300])
            self.assertTrue(response.json()['openapi'].startswith('3.'))

    def test_shop_schema_lists_only_shop_endpoints(self):
        paths = self.shop.get('/api/v1/schema/', HTTP_ACCEPT='application/vnd.oai.openapi+json').json()['paths']
        self.assertIn('/api/v1/orders', paths)
        self.assertIn('/api/v1/auth/phone/verify', paths)
        self.assertNotIn('/api/v1/dashboard', paths)


class AdminHostTests(BusinessTestCase):
    def test_admin_domain_points_at_the_admin_api(self):
        response = self.make_client(ADMIN_HOST).get('/api/v1/auth/csrf')
        self.assertEqual(response.status_code, 204)
        self.assertIn('csrftoken', response.cookies)
