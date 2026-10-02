from django.test import SimpleTestCase

from apps.core.models import Order, Product
from apps.core.services import OrderError, create_order, is_coordinates, resolve_items
from apps.core.utils import format_money, normalize_phone, parse_price, parse_quantity
from apps.platform.testing import BusinessTestCase


class UtilsTests(SimpleTestCase):
    def test_parse_price(self):
        self.assertEqual(parse_price('35 000'), 35000)
        self.assertEqual(parse_price('35 000 UZS'), 35000)
        self.assertEqual(parse_price('35000.00'), 35000)
        self.assertEqual(parse_price('35,000 so‘m'), 35000)
        self.assertEqual(parse_price('1.250.000'), 1250000)
        self.assertEqual(parse_price(None), 0)
        self.assertEqual(parse_price('free'), 0)

    def test_quantities_and_money(self):
        self.assertEqual((parse_quantity('2'), parse_quantity('2.0'), parse_quantity('x')), (2, 2, 1))
        self.assertEqual(format_money(1250000), '1 250 000')

    def test_normalize_phone(self):
        self.assertEqual(normalize_phone('90 123 45 67'), '+998901234567')
        self.assertEqual(normalize_phone('+998 (90) 123-45-67'), '+998901234567')
        self.assertEqual(normalize_phone('998901234567'), '+998901234567')
        self.assertIsNone(normalize_phone('12345'))

    def test_coordinates(self):
        self.assertTrue(is_coordinates('41.311081 69.240562'))
        self.assertFalse(is_coordinates('Chilonzor 9'))


class OrderServiceTests(BusinessTestCase):
    def setUp(self):
        super().setUp()
        self.burger = Product.objects.create(name_uz='Chizburger', name_ru='Чизбургер', price='35 000', desc_uz='',
                                             desc_ru='')

    def test_items_are_merged_and_clamped(self):
        items = resolve_items([{'product_id': self.burger.id, 'quantity': 60},
                               {'product_id': str(self.burger.id), 'quantity': 60},
                               {'product_id': self.burger.id, 'quantity': 0}])
        self.assertEqual(items, [(self.burger, 99)])

    def test_bad_items(self):
        for raw, code in ((None, 'empty'), ([], 'empty'), ([{'product_id': 'x'}], 'invalid_item'),
                          ([{'product_id': 999, 'quantity': 1}], 'product_not_found')):
            with self.assertRaises(OrderError) as error:
                resolve_items(raw)
            self.assertEqual(error.exception.code, code)

    def test_prices_come_from_the_catalog(self):
        order = create_order(items=[(self.burger, 2)], source='web', latitude=41.3, longitude=69.2,
                             delivery_type='teleport', payment_method='card')
        order = Order.objects.get(pk=order.pk)
        self.assertEqual((order.get_total(), order.location, order.delivery_type, order.payment_method),
                         (70000, '41.3 69.2', None, 'card'))
