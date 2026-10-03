import io
import os
import tempfile
from pathlib import Path
from unittest import mock

from django.core.cache import cache
from django.core.management import call_command
from django.test import SimpleTestCase, override_settings
from django_tenants.utils import get_public_schema_name, schema_context, tenant_context

from apps.core.models import Descriptions, User
from apps.platform import provisioning
from apps.platform.bots import hash_token
from apps.platform.crypto import decrypt, encrypt
from apps.platform.models import BotSetup, Business, BusinessBot, Domain
from apps.platform.telegram_api import TelegramError
from apps.platform.testing import BusinessTestCase
from .helpers import png

PUBLIC = get_public_schema_name()


class CryptoTests(SimpleTestCase):
    def test_tokens_are_stored_encrypted(self):
        secret = '123456:ABC-DEF'
        stored = encrypt(secret)
        self.assertNotIn('ABC', stored)
        self.assertEqual(decrypt(stored), secret)


class ProvisioningTests(BusinessTestCase):
    def test_slug_rules(self):
        for slug in ('ab', 'Burger', 'burger_house', '-burger', 'burger-', 'x' * 31):
            with self.assertRaisesMessage(provisioning.ProvisioningError, 'slug_invalid'):
                provisioning.validate_slug(slug)
        for slug in ('www', 'admin', 'burger-admin', 'deliveryhub', 'check-slug'):
            with self.assertRaisesMessage(provisioning.ProvisioningError, 'slug_reserved'):
                provisioning.validate_slug(slug)
        with self.assertRaisesMessage(provisioning.ProvisioningError, 'slug_taken'):
            provisioning.validate_slug('test-shop')
        provisioning.validate_slug('burger-house')

    @override_settings(PLATFORM_RESERVED_SUBDOMAINS=['norva', 'shop-builder'])
    def test_subdomains_of_other_projects_are_reserved(self):
        for slug in ('norva', 'shop-builder'):
            with self.assertRaisesMessage(provisioning.ProvisioningError, 'slug_reserved'):
                provisioning.validate_slug(slug)

    def test_tunnels_file_is_optional(self):
        provisioning.write_tunnels_file()  # TUNNELS_FILE is not set: nothing to do
        with tempfile.TemporaryDirectory() as directory, override_settings(TUNNELS_FILE=Path(directory) / 't.txt'):
            provisioning.write_tunnels_file()
            self.assertEqual((Path(directory) / 't.txt').read_text().split(),
                             ['deliveryhub', 'test-shop', 'test-shop-admin'])


class EnsurePlatformTests(BusinessTestCase):
    @override_settings(PLATFORM_DOMAIN='new.example')
    def test_domains_follow_the_platform_domain(self):
        env = {'PLATFORM_ADMIN_PHONE': '90 000 09 99', 'PLATFORM_ADMIN_PASSWORD': 'platform-pass-1'}
        with mock.patch.dict(os.environ, env), schema_context(PUBLIC):  # commands start in the public schema
            call_command('ensure_platform', stdout=io.StringIO())
            call_command('ensure_platform', stdout=io.StringIO())  # safe to run again
        domains = set(Domain.objects.values_list('domain', 'kind'))
        self.assertTrue({('test-shop.new.example', 'shop'), ('test-shop-admin.new.example', 'admin'),
                         ('deliveryhub.new.example', 'platform'), ('hub.localhost', 'platform')} <= domains)
        with schema_context(PUBLIC):
            admin = User.objects.get(phone_number='+998900000999')
            self.assertTrue(admin.is_superuser and admin.check_password('platform-pass-1'))


class DeleteBusinessTests(BusinessTestCase):
    def test_deletes_the_business_with_its_schema(self):
        from django.db import connection

        with schema_context(PUBLIC):
            provisioning.create_business(name='E2E', slug='e2e-run', owner_name='A', owner_phone='+998901112233',
                                         owner_password='secret-pass-1')
            call_command('delete_business', '--prefix', 'e2e-', '--yes', stdout=io.StringIO())
            self.assertFalse(Business.objects.filter(slug='e2e-run').exists())
            self.assertFalse(Domain.objects.filter(domain__startswith='e2e-run').exists())
            with connection.cursor() as cursor:
                cursor.execute("select 1 from information_schema.schemata where schema_name = 'e2e_run'")
                self.assertIsNone(cursor.fetchone())

    def test_unknown_slug(self):
        from django.core.management.base import CommandError

        with schema_context(PUBLIC), self.assertRaisesMessage(CommandError, 'No such business: nope'):
            call_command('delete_business', 'nope', '--yes', stdout=io.StringIO())


class PlatformTestCase(BusinessTestCase):
    def setUp(self):
        super().setUp()
        self.hub = self.platform_client()
        with schema_context(PUBLIC):
            self.staff = User.objects.create_superuser(phone_number='+998900000900', role='admin',
                                                       password='pass-12345', first_name='Hasan')
            self.not_staff = User.objects.create_user(phone_number='+998900000901', role='admin',
                                                      password='pass-12345')

    def sign_in(self):
        with schema_context(PUBLIC):
            self.hub.force_login(self.staff)


class PlatformAuthTests(PlatformTestCase):
    def test_only_platform_staff_get_in(self):
        self.assertEqual(self.hub.get('/api/v1/businesses').status_code, 401)
        response = self.hub.post('/api/v1/auth/login', {'phone': '+998900000901', 'password': 'pass-12345'},
                                 format='json')
        self.assertEqual(response.json(), {'error': 'invalid_credentials'})
        response = self.hub.post('/api/v1/auth/login', {'phone': '90 000 09 00', 'password': 'pass-12345'},
                                 format='json')
        self.assertEqual(response.json(), {'user': {'id': self.staff.id, 'phone_number': '+998900000900',
                                                    'first_name': 'Hasan'}})
        self.assertEqual(self.hub.get('/api/v1/auth/me').json()['user']['id'], self.staff.id)

    def test_business_staff_session_means_nothing_here(self):
        business_admin = User.objects.create_user(phone_number='+998900000900', role='admin', password='pass-12345')
        self.hub.force_login(business_admin)  # a session in the business's schema
        self.assertEqual(self.hub.get('/api/v1/auth/me').status_code, 401)


class BusinessesTests(PlatformTestCase):
    def setUp(self):
        super().setUp()
        self.sign_in()

    def test_list(self):
        self.add_bot(BusinessBot.ROLE_CLIENT, username='shop_bot')
        data = self.hub.get('/api/v1/businesses').json()
        self.assertEqual(data['domain'], 'example.uz')
        self.assertEqual(data['totals'], {'businesses': 1, 'active': 1, 'orders_today': 0, 'revenue_today': 0})
        card = data['results'][0]
        self.assertEqual((card['slug'], card['name'], card['status']), ('test-shop', 'Test Shop', 'active'))
        self.assertEqual(card['links'], {'shop': 'http://test-shop.localhost/',
                                         'admin': 'http://test-shop-admin.localhost/'})
        self.assertEqual(card['bots'], {'client': {'username': 'shop_bot', 'alive': False, 'created_via': 'token'},
                                        'admin': None})
        self.assertEqual(card['stats'], {'orders_today': 0, 'revenue_today': 0, 'orders_total': 0, 'customers': 0})

    def test_public_addresses_on_the_public_host(self):
        public = self.make_client('deliveryhub.example.uz')
        with schema_context(PUBLIC):
            public.force_login(self.staff)
        card = public.get('/api/v1/businesses').json()['results'][0]
        self.assertEqual(card['links']['shop'], 'https://test-shop.example.uz/')

    def test_check_slug(self):
        def check(slug):
            return self.hub.get(f'/api/v1/businesses/check-slug?slug={slug}').json()
        self.assertEqual(check('burger-house'), {'available': True})
        self.assertEqual(check('Bu'), {'available': False, 'error': 'slug_invalid'})
        self.assertEqual(check('www'), {'available': False, 'error': 'slug_reserved'})
        self.assertEqual(check('test-shop'), {'available': False, 'error': 'slug_taken'})

    def test_create_validation(self):
        response = self.hub.post('/api/v1/businesses', {'name': 'X', 'slug': 'test-shop', 'owner_name': 'A',
                                                        'owner_phone': '12', 'brand_color': 'red'}, format='json')
        self.assertEqual(response.json(), {'error': 'validation', 'fields': {
            'slug': ['slug_taken'], 'owner_phone': ['invalid'], 'brand_color': ['invalid']}})

    def test_open_a_business_and_use_it(self):
        response = self.hub.post('/api/v1/businesses', {
            'name': 'Burger House', 'slug': 'burger-house', 'owner_name': 'Aziz', 'owner_phone': '90 111 22 33',
            'owner_password': '', 'support_phone': '+998712001122', 'min_order': 30000, 'brand_color': '#FF6B00',
            'logo': png('logo.png'),
        }, format='multipart')
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        password = body['credentials']['password']
        self.assertEqual(body['credentials']['phone'], '+998901112233')
        self.assertTrue(len(password) >= 12)
        detail = body['business']
        self.assertEqual((detail['slug'], detail['min_order'], detail['brand_color']),
                         ('burger-house', 30000, '#ff6b00'))
        self.assertEqual(detail['owner'], {'name': 'Aziz', 'phone': '+998901112233'})
        self.assertEqual(detail['missing_roles'], ['client', 'admin'])
        self.assertTrue(detail['logo'].startswith('/media/public/logos/'))
        self.assertIsNone(detail['platform_bot'])

        business = Business.objects.get(slug='burger-house')
        self.assertEqual(business.schema_name, 'burger_house')
        self.assertEqual(
            set(Domain.objects.filter(tenant=business).values_list('domain', 'kind')),
            {('burger-house.example.uz', 'shop'), ('burger-house-admin.example.uz', 'admin'),
             ('burger-house.localhost', 'shop'), ('burger-house-admin.localhost', 'admin')},
        )
        with tenant_context(business):
            self.assertTrue(Descriptions.objects.filter(name_uz='dona').exists())

        # The new business answers on its own hosts, with its own data and its own logo address.
        shop = self.make_client('burger-house.localhost').get('/api/v1/shop').json()
        self.assertEqual((shop['business']['name'], shop['business']['logo']), ('Burger House', detail['logo']))
        self.assertEqual(self.make_client('burger-house.localhost').get(detail['logo']).status_code, 200)
        admin = self.make_client('burger-house-admin.localhost')
        response = admin.post('/api/v1/auth/login', {'phone': '+998901112233', 'password': password}, format='json')
        self.assertEqual(response.json()['business']['slug'], 'burger-house')
        self.assertEqual(admin.get('/api/v1/products').json()['count'], 0)
        # The same session means nothing in another business (sessions live in each business's schema).
        self.assertEqual(admin.get('/api/v1/products', HTTP_HOST='admin.test').status_code, 401)

    def test_edit_profile(self):
        response = self.hub.patch('/api/v1/businesses/test-shop', {'tagline': 'Eng mazali', 'delivery_time': '',
                                                                   'min_order': 20000}, format='json')
        body = response.json()
        self.assertEqual((body['tagline'], body['delivery_time'], body['min_order']), ('Eng mazali', '30–45', 20000))
        response = self.hub.patch('/api/v1/businesses/test-shop', {'name': ''}, format='json')
        self.assertEqual(response.json(), {'error': 'validation', 'fields': {'name': ['blank']}})
        self.assertEqual(self.hub.get('/api/v1/businesses/nope').json(), {'error': 'not_found'})

    def test_suspend_and_activate(self):
        with tempfile.TemporaryDirectory() as directory, override_settings(TUNNELS_FILE=Path(directory) / 't.txt'):
            response = self.hub.post('/api/v1/businesses/test-shop/status', {'status': 'suspended'}, format='json')
            self.assertEqual(response.json()['status'], 'suspended')
            self.assertNotIn('test-shop', (Path(directory) / 't.txt').read_text().split())
        self.assertEqual(self.shop.get('/api/v1/shop').status_code, 503)
        self.hub.post('/api/v1/businesses/test-shop/status', {'status': 'active'}, format='json')
        self.assertEqual(self.shop.get('/api/v1/shop').status_code, 200)
        response = self.hub.post('/api/v1/businesses/test-shop/status', {'status': 'gone'}, format='json')
        self.assertEqual(response.json()['fields'], {'status': ['invalid_choice']})

    def test_owner_password(self):
        self.assertEqual(self.hub.post('/api/v1/businesses/test-shop/owner-password').json(),
                         {'error': 'owner_missing'})
        owner = User.objects.create_user(phone_number='+998901112233', role='admin', password='old-pass-1')
        body = self.hub.post('/api/v1/businesses/test-shop/owner-password').json()
        self.assertEqual(body['phone'], '+998901112233')
        owner.refresh_from_db()
        self.assertTrue(owner.check_password(body['password']))


class BotTests(PlatformTestCase):
    def setUp(self):
        super().setUp()
        self.sign_in()
        cache.delete('platform_bot_me')

    def test_setup_link_needs_the_platform_bot(self):
        response = self.hub.post('/api/v1/businesses/test-shop/bots/setup-link')
        self.assertEqual(response.json(), {'error': 'platform_bot_missing'})

    @override_settings(PLATFORM_BOT_TOKEN='1:PLATFORM')
    def test_setup_link(self):
        with mock.patch('apps.platform.bots.get_me', return_value={'id': 1, 'username': 'hub_bot'}):
            body = self.hub.post('/api/v1/businesses/test-shop/bots/setup-link').json()
            detail = self.hub.get('/api/v1/businesses/test-shop').json()
        self.assertTrue(body['url'].startswith('https://t.me/hub_bot?start=setup_'))
        self.assertIn('<svg', body['qr_svg'])
        token = body['url'].split('setup_', 1)[1]
        self.assertTrue(BotSetup.objects.filter(business=self.tenant, token_hash=hash_token(token)).exists())
        self.assertEqual(detail['platform_bot'], {'username': 'hub_bot'})

    def test_connect_with_a_token(self):
        me = {'id': 3003, 'username': 'burger_bot', 'first_name': 'Burger'}
        with mock.patch('apps.platform.bots.get_me', return_value=me):
            response = self.hub.post('/api/v1/businesses/test-shop/bots',
                                     {'role': 'client', 'token': ' 3003:TOKEN-FROM-BOTFATHER '}, format='json')
        self.assertEqual(response.json(), {'bot': {'username': 'burger_bot', 'alive': False, 'created_via': 'token'}})
        bot = BusinessBot.objects.get(business=self.tenant, role='client')
        self.assertEqual(bot.token, '3003:TOKEN-FROM-BOTFATHER')
        self.assertNotIn('TOKEN-FROM', bot.token_encrypted)

        with mock.patch('apps.platform.bots.get_me', return_value=me):  # the same bot for the other role
            response = self.hub.post('/api/v1/businesses/test-shop/bots', {'role': 'admin', 'token': '3003:X'},
                                     format='json')
        self.assertEqual(response.json(), {'error': 'bot_in_use'})
        with mock.patch('apps.platform.bots.get_me', side_effect=TelegramError('getMe', 'Unauthorized', 401)):
            response = self.hub.post('/api/v1/businesses/test-shop/bots', {'role': 'admin', 'token': 'bad'},
                                     format='json')
        self.assertEqual(response.json(), {'error': 'invalid_token'})

        self.assertEqual(self.hub.delete('/api/v1/businesses/test-shop/bots/client').status_code, 204)
        self.assertFalse(BusinessBot.objects.exists())
        self.assertEqual(self.hub.delete('/api/v1/businesses/test-shop/bots/nope').status_code, 404)
