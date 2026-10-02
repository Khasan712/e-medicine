"""The voice / text order understanding pipeline (apps.voice.understanding); Gemini is mocked."""
import json
import time
from types import SimpleNamespace as NS
from unittest import mock

from django.test import SimpleTestCase, override_settings

from apps.voice import understanding as voice

CATALOG = [
    {'id': 1, 'uz': 'Chizburger', 'ru': 'Чизбургер', 'price': 35000, 'unit': 'dona'},
    {'id': 2, 'uz': 'Dabl Burger', 'ru': 'Дабл Бургер', 'price': 48000, 'unit': 'dona'},
    {'id': 3, 'uz': 'Tovuqli Burger', 'ru': 'Куриный Бургер', 'price': 32000, 'unit': 'dona'},
    {'id': 4, 'uz': 'Pepperoni', 'ru': 'Пепперони', 'price': 95000, 'unit': 'dona'},
]


@override_settings(GEMINI_API_KEY='test-key')
class GeminiPipelineTests(SimpleTestCase):
    def test_model_output_is_sanitized(self):
        model_output = {
            'transcript': '2 ta chizburger', 'customer_name': ' Aziz ', 'phone': '90 123 45 67', 'address': '',
            'delivery_type': 'teleport', 'payment_method': 'card', 'status': 'completed', 'comment': '',
            'items': [{'product_id': 1, 'quantity': 500}, {'product_id': 424242, 'quantity': 1}],
            'unmatched': ['kola'], 'submit': True, 'reply': 'OK',
        }
        with mock.patch.object(voice, 'understand_with_gemini', return_value=model_output):
            result, engine = voice.understand(CATALOG, {}, text='2 ta chizburger')
        self.assertEqual(engine, 'gemini')
        self.assertEqual(result['items'], [{'product_id': 1, 'quantity': 99}])  # unknown id dropped, clamped
        self.assertEqual((result['customer_name'], result['phone'], result['delivery_type']),
                         ('Aziz', '+998901234567', ''))
        self.assertEqual((result['unmatched'], result['submit']), (['kola'], True))

    def test_audio_is_transcribed_then_understood(self):
        with mock.patch.object(voice, 'transcribe', return_value='bitta chizburger') as transcribe, \
                mock.patch.object(voice, 'understand_with_gemini', return_value={'items': []}) as understand:
            result, _ = voice.understand(CATALOG, {}, audio=b'fake-audio', mime_type='audio/webm;codecs=opus')
        transcribe.assert_called_once()
        self.assertEqual(understand.call_args.kwargs['text'], 'bitta chizburger')
        self.assertEqual(result['transcript'], 'bitta chizburger')

    def test_transcription_failure_falls_back_to_a_multimodal_call(self):
        with mock.patch.object(voice, 'transcribe', side_effect=voice.VoiceError('transcription_failed')), \
                mock.patch.object(voice, 'understand_with_gemini', return_value={'items': []}) as understand:
            voice.understand(CATALOG, {}, audio=b'fake-audio', mime_type='audio/webm')
        self.assertEqual(understand.call_args.kwargs['audio'], b'fake-audio')

    def test_full_recording_wins_over_live_captions(self):
        with mock.patch.object(voice, 'transcribe', return_value='chizburgerdan ikkita, dabl burgerdan sakkizta'), \
                mock.patch.object(voice, 'understand_with_gemini', return_value={'items': []}) as understand:
            voice.understand(CATALOG, {}, audio=b'a', mime_type='audio/webm', live_text='4 ta dabl burgerdan 4 ta')
        self.assertEqual(understand.call_args.kwargs['text'], 'chizburgerdan ikkita, dabl burgerdan sakkizta')

    def test_live_captions_are_the_fallback_when_transcription_fails(self):
        with mock.patch.object(voice, 'transcribe', side_effect=voice.VoiceError('transcription_failed')), \
                mock.patch.object(voice, 'understand_with_gemini', return_value={'items': []}) as understand:
            voice.understand(CATALOG, {}, audio=b'a', mime_type='audio/webm', live_text='bitta chizburger')
        self.assertEqual(understand.call_args.kwargs['text'], 'bitta chizburger')
        self.assertNotIn('audio', understand.call_args.kwargs)

    @override_settings(GEMINI_PARSE_MODEL='slow-model', GEMINI_PARSE_FALLBACK_MODELS=['fast-model'],
                       GEMINI_PARSE_HEDGE_SECONDS=0.05)
    def test_slow_model_is_hedged(self):
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
        part = NS(audio_transcription=NS(text='Две пиццы и один чизбургер'), text=None)
        client = mock.Mock()
        client.models.generate_content.return_value = NS(candidates=[NS(content=NS(parts=[part]))])
        with mock.patch.object(voice, 'get_client', return_value=client):
            self.assertEqual(voice.transcribe(b'audio', 'audio/webm', []), 'Две пиццы и один чизбургер')

    @override_settings(GEMINI_PARSE_MODEL='busy-model', GEMINI_PARSE_FALLBACK_MODELS=['spare-model'])
    def test_busy_model_falls_back(self):
        client = mock.Mock()
        client.models.generate_content.side_effect = [
            Exception('503 UNAVAILABLE. This model is currently experiencing high demand.'),
            NS(text=json.dumps({'items': [{'product_id': 1, 'quantity': 1}], 'reply': 'OK'})),
        ]
        with mock.patch.object(voice, 'get_client', return_value=client):
            result = voice.understand_with_gemini([], {}, text='bitta chizburger', lang='ru')
        self.assertEqual(result['reply'], 'OK')
        self.assertEqual([c.kwargs['model'] for c in client.models.generate_content.call_args_list],
                         ['busy-model', 'spare-model'])
        self.assertIn('REPLY LANGUAGE: Russian', client.models.generate_content.call_args.kwargs['contents'][0])

    @override_settings(GEMINI_PARSE_MODEL='model-a', GEMINI_PARSE_FALLBACK_MODELS=['model-b'])
    def test_non_transient_error_is_not_retried(self):
        client = mock.Mock()
        client.models.generate_content.side_effect = Exception('400 INVALID_ARGUMENT: API key not valid')
        with mock.patch.object(voice, 'get_client', return_value=client), self.assertRaises(voice.VoiceError):
            voice.understand_with_gemini([], {}, text='x')
        self.assertEqual(client.models.generate_content.call_count, 1)

    @override_settings(GEMINI_LIVE_MODEL='gemini-3.5-transcribe-live')
    def test_live_setup_message(self):
        setup = voice.live_setup(CATALOG)['setup']
        self.assertEqual(setup['model'], 'models/gemini-3.5-transcribe-live')
        self.assertIn('Chizburger', setup['inputAudioTranscription']['customVocabulary'])
        self.assertEqual(setup['inputAudioTranscription']['mode'], 'VERBATIM')  # captions show what was heard


@override_settings(GEMINI_API_KEY='')
class LocalParserTests(SimpleTestCase):
    def parse(self, text, state=None):
        return voice.local_understand(CATALOG, voice.clean_state(state or {}), text)

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
        self.assertEqual((result['customer_name'], result['phone'], result['address']),
                         ('Aziz', '+998901234567', 'Chilonzor 9-kvartal'))
        self.assertEqual((result['delivery_type'], result['payment_method'], result['status'], result['submit']),
                         ('delivery', 'card', 'completed', True))

    def test_clear(self):
        result = self.parse('hammasini tozala', {'items': [{'product_id': 1, 'quantity': 3}], 'customer_name': 'A'})
        self.assertEqual((result['items'], result['customer_name']), ([], ''))

    def test_text_without_gemini_uses_the_local_parser(self):
        result, engine = voice.understand(CATALOG, {}, text='2 ta chizburger')
        self.assertEqual((engine, result['items']), ('local', [{'product_id': 1, 'quantity': 2}]))
        with self.assertRaises(voice.VoiceError):
            voice.understand(CATALOG, {}, audio=b'a')
