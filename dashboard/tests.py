import json
from unittest import mock

from django.test import TestCase, override_settings

from app.models import Category, Descriptions, Order, Product, User
from dashboard import voice


class SalesTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998900000009', role='manager', password='pass-12345')
        self.client.force_login(self.user)
        unit = Descriptions.objects.create(name_uz='dona', name_ru='шт')
        category = Category.objects.create(name_uz='Burgerlar', name_ru='Бургеры')
        self.burger = Product.objects.create(name_uz='Chizburger', name_ru='Чизбургер', price='35 000',
                                             desc_uz='-', desc_ru='-', measure=unit, category=category)
        self.hotdog = Product.objects.create(name_uz='Klassik Hot-Dog', name_ru='Классический Хот-Дог', price='25 000',
                                             desc_uz='-', desc_ru='-', measure=unit, category=category)

    def post_json(self, url, data):
        return self.client.post(url, data=json.dumps(data), content_type='application/json')


@override_settings(GEMINI_API_KEY='')
class SalesViewsTests(SalesTestCase):
    def test_requires_login(self):
        self.client.logout()
        response = self.client.get('/sales/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response['Location'])

    def test_page_renders(self):
        response = self.client.get('/sales/')
        self.assertEqual(response.status_code, 200)
        config = response.context['sales_config']
        self.assertEqual(len(config['products']), 2)
        self.assertFalse(config['voice']['gemini'])

    def test_create_sale_without_client(self):
        response = self.post_json('/sales/create/', {
            'items': [{'product_id': self.burger.id, 'quantity': 2}, {'product_id': self.hotdog.id, 'quantity': 1}],
            'customer_name': 'Aziz', 'phone': '90 123 45 67', 'delivery_type': 'pickup', 'payment_method': 'card',
        })
        self.assertEqual(response.status_code, 201)
        body = response.json()
        order = Order.objects.get(pk=body['order']['id'])
        self.assertIsNone(order.client)
        self.assertEqual((order.source, order.status, order.created_by, order.phone, order.display_name),
                         ('admin', 'completed', self.user, '+998901234567', 'Aziz'))
        self.assertEqual(order.get_total(), 95000)
        self.assertEqual((body['stats']['count'], body['stats']['revenue']), (1, 95000))

    def test_delivery_sale_defaults_to_ordered(self):
        response = self.post_json('/sales/create/', {'items': [{'product_id': self.burger.id, 'quantity': 1}],
                                                     'delivery_type': 'delivery', 'address': 'Chilonzor'})
        order = Order.objects.get(pk=response.json()['order']['id'])
        self.assertEqual((order.status, order.location), ('ordered', 'Chilonzor'))

    def test_create_sale_rejects_bad_items(self):
        self.assertEqual(self.post_json('/sales/create/', {'items': []}).status_code, 400)
        self.assertEqual(self.post_json('/sales/create/', {'items': [{'product_id': 999, 'quantity': 1}]}).json()['error'],
                         'product_not_found')

    def test_voice_parse_local_fallback(self):
        response = self.post_json('/sales/voice/parse/', {
            'text': 'ikkita chizburger va bitta klassik hot-dog, mijoz Aziz, telefon 90 123 45 67, naqd',
            'state': {'items': [], 'delivery_type': 'pickup'},
        })
        body = response.json()
        self.assertEqual(body['engine'], 'local')
        self.assertEqual(sorted((i['product_id'], i['quantity']) for i in body['result']['items']),
                         sorted([(self.burger.id, 2), (self.hotdog.id, 1)]))
        self.assertEqual((body['result']['customer_name'], body['result']['phone'], body['result']['payment_method']),
                         ('Aziz', '+998901234567', 'cash'))

    def test_voice_audio_needs_gemini(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        audio = SimpleUploadedFile('voice.webm', b'\x1a\x45\xdf\xa3fake', content_type='audio/webm')
        response = self.client.post('/sales/voice/parse/', {'audio': audio, 'state': '{}'})
        self.assertEqual((response.status_code, response.json()['error']), (400, 'not_configured'))
        self.assertEqual(self.client.post('/sales/voice/token/').status_code, 400)


@override_settings(GEMINI_API_KEY='test-key')
class GeminiPipelineTests(SalesTestCase):
    def test_model_output_is_sanitized(self):
        model_output = {
            'transcript': '2 ta chizburger', 'customer_name': ' Aziz ', 'phone': '90 123 45 67', 'address': '',
            'delivery_type': 'teleport', 'payment_method': 'card', 'status': 'completed', 'comment': '',
            'items': [{'product_id': self.burger.id, 'quantity': 500}, {'product_id': 424242, 'quantity': 1}],
            'unmatched': ['kola'], 'submit': True, 'reply': 'OK',
        }
        with mock.patch.object(voice, 'understand_with_gemini', return_value=model_output) as understand:
            body = self.post_json('/sales/voice/parse/', {'text': '2 ta chizburger', 'state': {}}).json()
        understand.assert_called_once()
        result = body['result']
        self.assertEqual(body['engine'], 'gemini')
        self.assertEqual(result['items'], [{'product_id': self.burger.id, 'quantity': 99}])  # unknown id dropped, clamped
        self.assertEqual((result['customer_name'], result['phone'], result['delivery_type']), ('Aziz', '+998901234567', ''))
        self.assertEqual((result['unmatched'], result['submit']), (['kola'], True))

    def test_audio_is_transcribed_then_understood(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        audio = SimpleUploadedFile('voice.webm', b'fake-audio', content_type='audio/webm;codecs=opus')
        with mock.patch.object(voice, 'transcribe', return_value='bitta chizburger') as transcribe, \
                mock.patch.object(voice, 'understand_with_gemini', return_value={
                    'items': [{'product_id': self.burger.id, 'quantity': 1}]}) as understand:
            body = self.client.post('/sales/voice/parse/', {'audio': audio, 'state': '{}'}).json()
        transcribe.assert_called_once()
        self.assertEqual(understand.call_args.kwargs['text'], 'bitta chizburger')
        self.assertEqual(body['result']['transcript'], 'bitta chizburger')

    def test_transcription_failure_falls_back_to_multimodal_call(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        audio = SimpleUploadedFile('voice.webm', b'fake-audio', content_type='audio/webm')
        with mock.patch.object(voice, 'transcribe', side_effect=voice.VoiceError('transcription_failed')), \
                mock.patch.object(voice, 'understand_with_gemini', return_value={'transcript': 'x', 'items': []}) as understand:
            response = self.client.post('/sales/voice/parse/', {'audio': audio, 'state': '{}'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(understand.call_args.kwargs['audio'], b'fake-audio')

    def test_live_token(self):
        session = {'token': 'auth_tokens/abc', 'url': 'wss://example', 'setup': {'setup': {}}}
        with mock.patch.object(voice, 'create_live_session', return_value=session):
            self.assertEqual(self.client.post('/sales/voice/token/').json(), session)

    def test_full_recording_wins_over_live_captions(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        audio = SimpleUploadedFile('voice.webm', b'fake-audio', content_type='audio/webm')
        with mock.patch.object(voice, 'transcribe', return_value='chizburgerdan ikkita, dabl burgerdan sakkizta'), \
                mock.patch.object(voice, 'understand_with_gemini', return_value={'items': []}) as understand:
            self.client.post('/sales/voice/parse/', {'audio': audio, 'state': '{}', 'live_text': '4 ta dabl burgerdan 4 ta'})
        self.assertEqual(understand.call_args.kwargs['text'], 'chizburgerdan ikkita, dabl burgerdan sakkizta')

    def test_live_captions_are_the_fallback_when_transcription_fails(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        audio = SimpleUploadedFile('voice.webm', b'fake-audio', content_type='audio/webm')
        with mock.patch.object(voice, 'transcribe', side_effect=voice.VoiceError('transcription_failed')), \
                mock.patch.object(voice, 'understand_with_gemini', return_value={'items': []}) as understand:
            self.client.post('/sales/voice/parse/', {'audio': audio, 'state': '{}', 'live_text': 'bitta chizburger'})
        self.assertEqual(understand.call_args.kwargs['text'], 'bitta chizburger')
        self.assertNotIn('audio', understand.call_args.kwargs)

    @override_settings(GEMINI_PARSE_MODEL='slow-model', GEMINI_PARSE_FALLBACK_MODELS=['fast-model'], GEMINI_PARSE_HEDGE_SECONDS=0.05)
    def test_slow_model_is_hedged(self):
        import time

        def generate(model, contents, config):
            if model == 'slow-model':
                time.sleep(1)
                return {'reply': 'slow'}
            return {'reply': 'fast'}

        with mock.patch.object(voice, '_generate_json', side_effect=generate):
            started = time.monotonic()
            result = voice.understand_with_gemini([], {}, text='x')
        self.assertEqual(result['reply'], 'fast')
        self.assertLess(time.monotonic() - started, 0.9)

    def test_transcript_is_read_from_audio_transcription_parts(self):
        from types import SimpleNamespace as NS
        part = NS(audio_transcription=NS(text='Две пиццы и один чизбургер'), text=None)
        response = NS(candidates=[NS(content=NS(parts=[part]))])
        client = mock.Mock()
        client.models.generate_content.return_value = response
        with mock.patch.object(voice, 'get_client', return_value=client):
            self.assertEqual(voice.transcribe(b'audio', 'audio/webm', []), 'Две пиццы и один чизбургер')

    @override_settings(GEMINI_PARSE_MODEL='busy-model', GEMINI_PARSE_FALLBACK_MODELS=['spare-model'])
    def test_busy_model_falls_back(self):
        from types import SimpleNamespace as NS
        client = mock.Mock()
        client.models.generate_content.side_effect = [
            Exception('503 UNAVAILABLE. This model is currently experiencing high demand.'),
            NS(text=json.dumps({'items': [{'product_id': self.burger.id, 'quantity': 1}], 'reply': 'OK'})),
        ]
        with mock.patch.object(voice, 'get_client', return_value=client):
            result = voice.understand_with_gemini([], {}, text='bitta chizburger', lang='ru')
        self.assertEqual(result['reply'], 'OK')
        self.assertEqual([c.kwargs['model'] for c in client.models.generate_content.call_args_list], ['busy-model', 'spare-model'])
        self.assertIn('REPLY LANGUAGE: Russian', client.models.generate_content.call_args.kwargs['contents'][0])

    @override_settings(GEMINI_PARSE_MODEL='model-a', GEMINI_PARSE_FALLBACK_MODELS=['model-b'])
    def test_non_transient_error_is_not_retried(self):
        client = mock.Mock()
        client.models.generate_content.side_effect = Exception('400 INVALID_ARGUMENT: API key not valid')
        with mock.patch.object(voice, 'get_client', return_value=client), self.assertRaises(voice.VoiceError):
            voice.understand_with_gemini([], {}, text='x')
        self.assertEqual(client.models.generate_content.call_count, 1)

    def test_parse_uses_dashboard_language(self):
        session = self.client.session
        session['dashboard_lang'] = 'ru'
        session.save()
        with mock.patch.object(voice, 'understand_with_gemini', return_value={'items': []}) as understand:
            self.post_json('/sales/voice/parse/', {'text': 'один чизбургер', 'state': {}})
        self.assertEqual(understand.call_args.kwargs['lang'], 'ru')

    def test_live_setup_message(self):
        catalog = voice.build_catalog(Product.objects.select_related('measure'))
        setup = voice.live_setup(catalog)['setup']
        self.assertEqual(setup['model'], 'models/gemini-3.5-transcribe-live')
        self.assertIn('Chizburger', setup['inputAudioTranscription']['customVocabulary'])
        self.assertEqual(setup['inputAudioTranscription']['mode'], 'VERBATIM')  # captions show what was heard


class LocalParserTests(TestCase):
    catalog = [
        {'id': 1, 'uz': 'Chizburger', 'ru': 'Чизбургер', 'price': 35000, 'unit': 'dona'},
        {'id': 2, 'uz': 'Dabl Burger', 'ru': 'Дабл Бургер', 'price': 48000, 'unit': 'dona'},
        {'id': 3, 'uz': 'Tovuqli Burger', 'ru': 'Куриный Бургер', 'price': 32000, 'unit': 'dona'},
        {'id': 4, 'uz': 'Pepperoni', 'ru': 'Пепперони', 'price': 95000, 'unit': 'dona'},
    ]

    def parse(self, text, state=None):
        return voice.local_understand(self.catalog, voice.clean_state(state or {}), text)

    def items(self, result):
        return {item['product_id']: item['quantity'] for item in result['items']}

    def test_quantities_before_and_after_names(self):
        self.assertEqual(self.items(self.parse('Dabl burger 2 ta, tovuqli burger bitta')), {2: 2, 3: 1})
        self.assertEqual(self.items(self.parse('2 ta chizburger 3 ta dabl burger')), {1: 2, 2: 3})
        self.assertEqual(self.items(self.parse('две пепперони и один чизбургер')), {4: 2, 1: 1})

    def test_edit_existing_order(self):
        state = {'items': [{'product_id': 1, 'quantity': 1}, {'product_id': 4, 'quantity': 1}]}
        self.assertEqual(self.items(self.parse('yana bitta chizburger', state)), {1: 2, 4: 1})
        self.assertEqual(self.items(self.parse('pepperonini olib tashla', state)), {1: 1})

    def test_fields(self):
        result = self.parse('mijoz Aziz, telefon 90 123 45 67, manzil Chilonzor 9-kvartal, karta, sotildi, saqla')
        self.assertEqual((result['customer_name'], result['phone'], result['address']), ('Aziz', '+998901234567', 'Chilonzor 9-kvartal'))
        self.assertEqual((result['delivery_type'], result['payment_method'], result['status'], result['submit']),
                         ('delivery', 'card', 'completed', True))

    def test_clear(self):
        result = self.parse('hammasini tozala', {'items': [{'product_id': 1, 'quantity': 3}], 'customer_name': 'A'})
        self.assertEqual((result['items'], result['customer_name']), ([], ''))


class DashboardHomeTests(TestCase):
    def test_home_renders_charts_with_recent_orders(self):
        user = User.objects.create_user(phone_number='+998900000010', role='admin', password='pass-12345')
        self.client.force_login(user)
        Order.objects.create(status='ordered', source='web')
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('datetime.date', response.content.decode())  # chart data must be valid JS

    def test_orders_list_source_filter(self):
        user = User.objects.create_user(phone_number='+998900000011', role='admin', password='pass-12345')
        self.client.force_login(user)
        web = Order.objects.create(status='ordered', source='web')
        sale = Order.objects.create(status='completed', source='admin', customer_name='Walk-in')
        response = self.client.get('/orders/?source=admin')
        ids = [order.id for order in response.context['orders']]
        self.assertEqual(ids, [sale.id])
        self.assertNotIn(web.id, ids)
        self.assertContains(response, 'Walk-in')
