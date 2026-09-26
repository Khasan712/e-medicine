import hashlib
import hmac
import json
import time
from datetime import timedelta
from unittest import mock
from urllib.parse import urlencode

from django.test import TestCase, override_settings
from django.utils import timezone

from app.models import Category, Client, Descriptions, Order, PhoneOTP, Product, TelegramLoginToken
from app.utils import normalize_phone, parse_price
from shop.auth import validate_webapp_init_data

BOT_TOKEN = '123456:TEST-TOKEN'


def signed_init_data(user, bot_token=BOT_TOKEN, auth_date=None, extra=None, sign_signature=True):
    fields = {'auth_date': str(auth_date or int(time.time())), 'query_id': 'AAE', 'user': json.dumps(user)}
    fields.update(extra or {})
    signed = fields if sign_signature else {k: v for k, v in fields.items() if k != 'signature'}
    secret = hmac.new(b'WebAppData', bot_token.encode(), hashlib.sha256).digest()
    check_string = '\n'.join(f'{k}={v}' for k, v in sorted(signed.items()))
    fields['hash'] = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


class UtilsTests(TestCase):
    def test_parse_price(self):
        self.assertEqual(parse_price('35 000'), 35000)
        self.assertEqual(parse_price('35 000 UZS'), 35000)
        self.assertEqual(parse_price('35000.00'), 35000)
        self.assertEqual(parse_price('35,000 so‘m'), 35000)
        self.assertEqual(parse_price('1.250.000'), 1250000)
        self.assertEqual(parse_price(None), 0)
        self.assertEqual(parse_price('free'), 0)

    def test_normalize_phone(self):
        self.assertEqual(normalize_phone('90 123 45 67'), '+998901234567')
        self.assertEqual(normalize_phone('+998 (90) 123-45-67'), '+998901234567')
        self.assertEqual(normalize_phone('998901234567'), '+998901234567')
        self.assertIsNone(normalize_phone('12345'))


class InitDataTests(TestCase):
    user = {'id': 42, 'first_name': 'Ali', 'username': 'ali'}

    def test_valid(self):
        payload = validate_webapp_init_data(signed_init_data(self.user), BOT_TOKEN)
        self.assertEqual(payload['user']['id'], 42)

    def test_signature_field_either_way(self):
        for sign_signature in (True, False):
            data = signed_init_data(self.user, extra={'signature': 'abc'}, sign_signature=sign_signature)
            self.assertIsNotNone(validate_webapp_init_data(data, BOT_TOKEN))

    def test_rejects_tampering_wrong_token_and_stale(self):
        data = signed_init_data(self.user)
        self.assertIsNone(validate_webapp_init_data(data.replace('Ali', 'Eve'), BOT_TOKEN))
        self.assertIsNone(validate_webapp_init_data(data, '999:OTHER'))
        stale = signed_init_data(self.user, auth_date=int(time.time()) - 3 * 86400)
        self.assertIsNone(validate_webapp_init_data(stale, BOT_TOKEN))
        self.assertIsNone(validate_webapp_init_data('', BOT_TOKEN))


@override_settings(TELEGRAM_BOT_TOKEN=BOT_TOKEN, SHOP_OTP_DEBUG=True, SMS_BACKEND='console', SHOP_MIN_ORDER=0)
class ShopApiTests(TestCase):
    def setUp(self):
        unit = Descriptions.objects.create(name_uz='dona', name_ru='шт')
        category = Category.objects.create(name_uz='Burgerlar', name_ru='Бургеры')
        self.burger = Product.objects.create(
            name_uz='Chizburger', name_ru='Чизбургер', price='35 000', desc_uz='-', desc_ru='-',
            measure=unit, category=category, img='products/none.jpg')
        self.cola = Product.objects.create(
            name_uz='Kola', name_ru='Кола', price='12 000 UZS', desc_uz='-', desc_ru='-', measure=unit)

    # -- helpers --------------------------------------------------------------
    def post(self, path, data, token=None):
        headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'} if token else {}
        return self.client.post(f'/shop/api/{path}', data=json.dumps(data), content_type='application/json', **headers)

    def get(self, path, token=None):
        headers = {'HTTP_AUTHORIZATION': f'Bearer {token}'} if token else {}
        return self.client.get(f'/shop/api/{path}', **headers)

    def login_by_phone(self, phone='+998901234567'):
        code = self.post('auth/phone/request/', {'phone': phone}).json()['debug_code']
        return self.post('auth/phone/verify/', {'phone': phone, 'code': code}).json()

    # -- catalog --------------------------------------------------------------
    def test_index_can_be_framed_by_telegram_web(self):
        response = self.client.get('/shop/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('X-Frame-Options', response)

    def test_bootstrap(self):
        data = self.get('bootstrap/').json()
        self.assertEqual({p['id']: p['price'] for p in data['products']}, {self.burger.id: 35000, self.cola.id: 12000})
        self.assertEqual([c['name_uz'] for c in data['categories']], ['Burgerlar'])
        self.assertIsNone(data['client'])

    # -- phone sign-in --------------------------------------------------------
    def test_phone_login_creates_then_reuses_client(self):
        first = self.login_by_phone()
        self.assertTrue(first['created'])
        PhoneOTP.objects.update(created_at=timezone.now() - timedelta(minutes=2))  # skip the resend cooldown
        second = self.login_by_phone()
        self.assertFalse(second['created'])
        self.assertEqual(first['client']['id'], second['client']['id'])
        self.assertEqual(self.get('me/', second['token']).json()['client']['phone'], '+998901234567')

    def test_wrong_code_counts_attempts_and_locks(self):
        self.post('auth/phone/request/', {'phone': '901234567'})
        response = self.post('auth/phone/verify/', {'phone': '901234567', 'code': '000000'})
        self.assertEqual(response.json(), {'error': 'invalid_code', 'attempts_left': 4})
        PhoneOTP.objects.update(attempts=5)
        response = self.post('auth/phone/verify/', {'phone': '901234567', 'code': '000000'})
        self.assertEqual(response.status_code, 429)

    def test_resend_cooldown_and_invalid_phone(self):
        self.assertEqual(self.post('auth/phone/request/', {'phone': '12'}).json()['error'], 'invalid_phone')
        self.post('auth/phone/request/', {'phone': '901234567'})
        response = self.post('auth/phone/request/', {'phone': '901234567'})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()['error'], 'too_soon')

    @override_settings(SHOP_OTP_DEBUG=False)
    def test_code_is_not_exposed_without_debug_flag(self):
        self.assertNotIn('debug_code', self.post('auth/phone/request/', {'phone': '901234567'}).json())

    def test_unverified_phone_does_not_open_someone_elses_account(self):
        victim = Client.objects.create(first_name='Victim', phone='+998901234567')  # typed at checkout, never verified
        data = self.login_by_phone()
        self.assertTrue(data['created'])
        self.assertNotEqual(data['client']['id'], victim.id)

    def test_telegram_shared_phone_is_trusted(self):
        telegram_client = Client.objects.create(first_name='Tg', tg_id='77', tg_phone='998901234567')
        data = self.login_by_phone()
        self.assertEqual(data['client']['id'], telegram_client.id)

    # -- Telegram sign-in -----------------------------------------------------
    def test_telegram_webapp_login(self):
        user = {'id': 777, 'first_name': 'Olim', 'username': 'olim', 'language_code': 'ru'}
        data = self.post('auth/telegram/webapp/', {'init_data': signed_init_data(user)}).json()
        client = Client.objects.get(tg_id='777')
        self.assertEqual((data['client']['id'], client.first_name, client.lang), (client.id, 'Olim', 'ru'))
        response = self.post('auth/telegram/webapp/', {'init_data': signed_init_data(user, bot_token='1:BAD')})
        self.assertEqual(response.status_code, 401)

    def test_telegram_deep_link_login(self):
        with mock.patch('shop.views.get_bot_username', return_value='test_bot'):
            start = self.post('auth/telegram/start/', {}).json()
        self.assertTrue(start['url'].startswith('https://t.me/test_bot?start=login_'))
        self.assertEqual(self.get(f"auth/telegram/check/?token={start['token']}").json(), {'status': 'pending'})

        # what the bot does after "/start login_<token>"
        client = Client.objects.create(first_name='Bot user', tg_id='900')
        TelegramLoginToken.objects.filter(token=start['token']).update(status='confirmed', client=client)
        confirmed = self.get(f"auth/telegram/check/?token={start['token']}").json()
        self.assertEqual((confirmed['status'], confirmed['client']['id']), ('confirmed', client.id))
        self.assertEqual(self.get(f"auth/telegram/check/?token={start['token']}").status_code, 404)  # single use

    # -- orders ---------------------------------------------------------------
    def test_order_requires_auth(self):
        self.assertEqual(self.post('orders/', {'items': []}).status_code, 401)
        self.assertEqual(self.get('orders/', 'garbage-token').status_code, 401)

    def test_order_validation(self):
        token = self.login_by_phone()['token']
        response = self.post('orders/', {'items': [{'product_id': self.burger.id, 'quantity': 1}],
                                         'name': 'Ali', 'phone': '12', 'delivery_type': 'delivery'}, token)
        self.assertEqual(response.json()['fields'], {'phone': 'invalid', 'address': 'required'})
        response = self.post('orders/', {'items': [{'product_id': 999999, 'quantity': 1}], 'name': 'A', 'phone': '901234567'}, token)
        self.assertEqual(response.json()['error'], 'product_not_found')
        self.assertEqual(self.post('orders/', {'items': []}, token).json()['error'], 'empty')

    def test_create_order_uses_server_prices(self):
        token = self.login_by_phone()['token']
        response = self.post('orders/', {
            'items': [{'product_id': self.burger.id, 'quantity': 2, 'price': 1},
                      {'product_id': self.cola.id, 'quantity': 1},
                      {'product_id': self.burger.id, 'quantity': 1}],
            'name': 'Ali Valiyev', 'phone': '90 123 45 67', 'delivery_type': 'delivery',
            'address': 'Chilonzor 9', 'lat': '41.28', 'lng': '69.20', 'payment_method': 'card',
            'comment': 'Piyozsiz', 'platform': 'miniapp',
        }, token)
        self.assertEqual(response.status_code, 201)
        data = response.json()['order']
        self.assertEqual(data['total'], 3 * 35000 + 12000)
        order = Order.objects.get(pk=data['id'])
        self.assertEqual((order.source, order.status, order.payment_method, order.customer_name),
                         ('miniapp', 'ordered', 'card', 'Ali Valiyev'))
        self.assertEqual((order.location, order.l_t, order.e_t), ('Chilonzor 9', '41.28', '69.2'))
        self.assertEqual(order.client.first_name, 'Ali')  # remembered for next time
        self.assertEqual([o['id'] for o in self.get('orders/', token).json()['orders']], [order.id])

    def test_pickup_order_ignores_address(self):
        token = self.login_by_phone()['token']
        response = self.post('orders/', {'items': [{'product_id': self.cola.id, 'quantity': 1}], 'name': 'Ali',
                                         'phone': '901234567', 'delivery_type': 'pickup', 'address': 'x'}, token)
        order = Order.objects.get(pk=response.json()['order']['id'])
        self.assertEqual((order.delivery_type, order.location, order.source), ('pickup', None, 'web'))

    def test_order_is_private(self):
        owner = self.login_by_phone('+998901111111')['token']
        other = self.login_by_phone('+998902222222')['token']
        order_id = self.post('orders/', {'items': [{'product_id': self.cola.id, 'quantity': 1}], 'name': 'A',
                                         'phone': '901111111', 'delivery_type': 'pickup'}, owner).json()['order']['id']
        self.assertEqual(self.get(f'orders/{order_id}/', owner).status_code, 200)
        self.assertEqual(self.get(f'orders/{order_id}/', other).status_code, 404)

    @override_settings(SHOP_MIN_ORDER=50000)
    def test_min_order(self):
        token = self.login_by_phone()['token']
        response = self.post('orders/', {'items': [{'product_id': self.cola.id, 'quantity': 1}], 'name': 'A',
                                         'phone': '901234567', 'delivery_type': 'pickup'}, token)
        self.assertEqual(response.json(), {'error': 'min_order', 'min_order': 50000})

    def test_profile_update(self):
        token = self.login_by_phone()['token']
        response = self.client.patch('/shop/api/me/', data=json.dumps({'first_name': 'Aziz', 'lang': 'ru', 'phone': '+1'}),
                                     content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {token}')
        client = response.json()['client']
        self.assertEqual((client['first_name'], client['lang'], client['phone']), ('Aziz', 'ru', '+998901234567'))
