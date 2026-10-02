"""Voice / text order entry: the admin panel "Sales" section (and, with its own async copy, the staff bot).

Pipeline (Google Gemini API):
  1. While the operator speaks, the browser streams microphone audio to the Gemini Live API
     (`gemini-3.5-transcribe-live`) with a short-lived ephemeral token and shows live captions.
     If live captions are unavailable, the recorded clip is transcribed on the server
     (`gemini-3.5-transcribe`, product names passed as custom vocabulary).
  2. The transcript + current form state + product catalog go to a Flash model with a JSON schema,
     which returns the complete updated order form (items matched to catalog ids).

Without GEMINI_API_KEY a local rule-based parser handles text (e.g. from the browser's speech API).
"""
import json
import logging
import re
import time
import warnings
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timedelta, timezone as dt_timezone
from difflib import SequenceMatcher

from django.conf import settings

from apps.core.utils import normalize_phone, parse_price

logger = logging.getLogger('voice')

LANGUAGE_CODES = ['uz-UZ', 'ru-RU']
LIVE_API_VERSION = 'v1alpha'  # ephemeral tokens are served by v1alpha
LIVE_WS_URL = (
    'wss://generativelanguage.googleapis.com/ws/'
    'google.ai.generativelanguage.{version}.GenerativeService.BidiGenerateContentConstrained'
)
MAX_QUANTITY = 99
FORM_FIELDS = ('customer_name', 'phone', 'address', 'delivery_type', 'payment_method', 'status', 'comment')
CHOICES = {
    'delivery_type': ('delivery', 'pickup'),
    'payment_method': ('cash', 'card'),
    'status': ('ordered', 'on_the_way', 'completed'),
}


class VoiceError(Exception):
    def __init__(self, code, message=''):
        super().__init__(message or code)
        self.code = code


def is_configured():
    return bool(settings.GEMINI_API_KEY)


def build_catalog(products):
    return [
        {
            'id': product.pk,
            'uz': product.name_uz,
            'ru': product.name_ru or product.name_uz,
            'price': parse_price(product.price),
            'unit': product.measure.name_uz if product.measure else '',
        }
        for product in products
    ]


def vocabulary(catalog, limit):
    """Product names bias speech recognition towards the words the operator actually uses."""
    terms = []
    for product in catalog:
        for name in (product['uz'], product['ru']):
            if name and name not in terms:
                terms.append(name)
    return terms[:limit]


# ---------------------------------------------------------------------------
# Gemini
# ---------------------------------------------------------------------------

_clients = {}


def get_client(api_version=None):
    from google import genai
    from google.genai import types

    if api_version not in _clients:
        http_options = types.HttpOptions(api_version=api_version) if api_version else None
        _clients[api_version] = genai.Client(api_key=settings.GEMINI_API_KEY, http_options=http_options)
    return _clients[api_version]


def live_setup(catalog):
    """Setup message the browser sends first on the Live API WebSocket."""
    return {
        'setup': {
            'model': f'models/{settings.GEMINI_LIVE_MODEL}',
            'generationConfig': {'responseModalities': ['TEXT']},
            'inputAudioTranscription': {
                'languageCodes': LANGUAGE_CODES,
                'customVocabulary': vocabulary(catalog, 100),
                'mode': 'VERBATIM',
            },
        }
    }


def create_live_session(catalog):
    """Mint a single-use ephemeral token locked to the transcription model (the API key never reaches the browser)."""
    from google.genai import types

    now = datetime.now(dt_timezone.utc)
    config = types.CreateAuthTokenConfig(
        uses=1,
        expire_time=now + timedelta(minutes=15),
        new_session_expire_time=now + timedelta(minutes=2),
        live_connect_constraints=types.LiveConnectConstraints(
            model=settings.GEMINI_LIVE_MODEL,
            config=types.LiveConnectConfig(
                response_modalities=['TEXT'],
                input_audio_transcription=types.AudioTranscriptionConfig(
                    language_codes=LANGUAGE_CODES,
                    custom_vocabulary=vocabulary(catalog, 100),
                    mode='VERBATIM',
                ),
            ),
        ),
    )
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')  # the SDK flags ephemeral tokens as experimental
            token = get_client(LIVE_API_VERSION).auth_tokens.create(config=config)
    except Exception as exc:
        logger.warning('Gemini ephemeral token failed: %s', exc)
        raise VoiceError('live_unavailable', str(exc))
    return {
        'token': token.name,
        'url': LIVE_WS_URL.format(version=LIVE_API_VERSION),
        'setup': live_setup(catalog),
    }


def normalize_mime(mime_type):
    mime_type = (mime_type or 'audio/webm').split(';')[0].strip().lower()
    return {'audio/x-m4a': 'audio/m4a', 'audio/mp4': 'audio/m4a', 'audio/x-wav': 'audio/wav',
            'audio/mpeg': 'audio/mp3'}.get(mime_type, mime_type)


def transcribe(audio, mime_type, catalog):
    from google.genai import types

    try:
        response = get_client().models.generate_content(
            model=settings.GEMINI_TRANSCRIBE_MODEL,
            contents=[types.Part.from_bytes(data=audio, mime_type=normalize_mime(mime_type))],
            config=types.GenerateContentConfig(
                audio_transcription_config=types.AudioTranscriptionConfig(
                    language_codes=LANGUAGE_CODES,
                    custom_vocabulary=vocabulary(catalog, 1000),
                    mode='SMART',
                ),
                automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                http_options=types.HttpOptions(timeout=30 * 1000),
            ),
        )
    except Exception as exc:
        logger.warning('Gemini transcription failed: %s', exc)
        raise VoiceError('transcription_failed', str(exc))

    # Transcribe models return the transcript in `audio_transcription` parts, not in plain text parts.
    texts = []
    for candidate in response.candidates or []:
        for part in (candidate.content.parts if candidate.content else None) or []:
            if part.audio_transcription and part.audio_transcription.text:
                texts.append(part.audio_transcription.text)
            elif part.text:
                texts.append(part.text)
    return ' '.join(texts).strip()


SYSTEM_PROMPT = """You are the order-entry assistant of a small food delivery business in Uzbekistan.
A staff member (the operator) dictates or types an order in Uzbek (Latin or Cyrillic script), Russian, or a mix of both.
You receive the product CATALOG, the CURRENT order form and the operator's new UTTERANCE (text or an audio recording).
Return the COMPLETE updated order form as JSON.

Rules:
- Start from the CURRENT form and change only what the utterance asks for; keep every other value as it is.
- items: match spoken product names to the CATALOG by meaning, spelling variants, Uzbek or Russian names, singular or plural. Use only catalog ids.
  * A plain mention sets the quantity ("ikkita chizburger" -> 2). "yana" / "ещё" / "qo'sh" adds to the existing quantity.
  * Remove an item on "olib tashla", "o'chir", "kerak emas", "убери", "удали", "не надо".
  * Default quantity is 1. Number words: bir/bitta=1, ikki/ikkita=2, uch/uchta=3, to'rt/to'rtta=4, besh/beshta=5, olti=6, yetti=7, sakkiz=8, to'qqiz=9, o'n=10; один/одна=1, два/две=2, три=3, четыре=4, пять=5.
  * Never invent products. If a product is not in the catalog or it is unclear which one is meant, put the spoken words into "unmatched".
- customer_name: the customer's name if said ("mijoz Aziz", "ismi Aziz", "Aziz akaga", "клиент Азиз", "для Азиза"). Uzbek names in Latin script, capitalized.
- phone: the customer's phone number exactly as said. Convert number words to digits group by group — Uzbek: nol 0, bir 1, ikki 2, uch 3, to'rt 4, besh 5, olti 6, yetti 7, sakkiz 8, to'qqiz 9, o'n 10, yigirma 20, o'ttiz 30, qirq 40, ellik 50, oltmish 60, yetmish 70, sakson 80, to'qson 90, yuz 100 (so "to'qson yetti, yetti yuz o'n bir, nol ikki, sakson sakkiz" is 97 711 02 88); Russian likewise. Format Uzbek numbers as +998 followed by the 9 spoken digits. Never reuse digits that were not said; leave empty if unclear.
- address: the delivery address as said (district, street, house, landmark), Uzbek in Latin script.
- delivery_type: "pickup" for o'zi olib ketadi / olib ketish / zalda / самовывоз / заберёт сам; "delivery" for yetkazib berish / dostavka / доставка or when an address is given.
- payment_method: "cash" for naqd / naqt / наличные; "card" for karta / plastik / click / payme / перевод / карта.
- status: "completed" if the order is already handed over or paid (sotildi, berildi, yakunlandi, выдан, оплачен); "on_the_way" for yo'lda / в пути; "ordered" for a new order that still has to be delivered.
- comment: extra wishes such as "piyozsiz", "achchiq bo'lsin", "без лука", a delivery time.
- Use an empty string for text fields that are unknown.
- If the operator asks to clear everything ("hammasini tozala", "yangidan", "очисти всё"), return an empty form.
- submit: true only if the operator explicitly asks to create / save / confirm the order now (yarat, saqla, tasdiqla, rasmiylashtir, "tayyor, yubor", создай, сохрани, оформи, подтверди).
- reply: one short friendly sentence in the REPLY LANGUAGE about what was understood or changed.
- transcript: when AUDIO is attached, the verbatim transcription of what was said; otherwise repeat the utterance text."""

ORDER_SCHEMA = {
    'type': 'object',
    'properties': {
        'transcript': {'type': 'string'},
        'customer_name': {'type': 'string'},
        'phone': {'type': 'string'},
        'address': {'type': 'string'},
        'delivery_type': {'type': 'string', 'enum': ['', 'delivery', 'pickup']},
        'payment_method': {'type': 'string', 'enum': ['', 'cash', 'card']},
        'status': {'type': 'string', 'enum': ['', 'ordered', 'on_the_way', 'completed']},
        'comment': {'type': 'string'},
        'items': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'product_id': {'type': 'integer'},
                    'quantity': {'type': 'integer', 'minimum': 1},
                },
                'required': ['product_id', 'quantity'],
            },
        },
        'unmatched': {'type': 'array', 'items': {'type': 'string'}},
        'submit': {'type': 'boolean'},
        'reply': {'type': 'string'},
    },
    'required': [
        'transcript', 'customer_name', 'phone', 'address', 'delivery_type', 'payment_method',
        'status', 'comment', 'items', 'unmatched', 'submit', 'reply',
    ],
}


REPLY_LANGUAGES = {'uz': 'Uzbek (Latin script)', 'ru': 'Russian'}


def _prompt(catalog, state, utterance, lang='uz'):
    catalog_lines = '\n'.join(
        f"{item['id']} | {item['uz']} | {item['ru']} | {item['price']} | {item['unit']}" for item in catalog
    )
    return (
        f'CATALOG (id | uzbek name | russian name | price UZS | unit):\n{catalog_lines}\n\n'
        f'CURRENT FORM:\n{json.dumps(state, ensure_ascii=False)}\n\n'
        f'REPLY LANGUAGE: {REPLY_LANGUAGES.get(lang, REPLY_LANGUAGES["uz"])}\n\n'
        f'UTTERANCE:\n{utterance}'
    )


def is_transient(exc):
    """Overloaded / rate-limited / timed-out calls are worth retrying on another model."""
    message = str(exc).lower()
    markers = ('503', 'unavailable', 'overloaded', 'high demand', '429', 'resource_exhausted', '500', 'internal',
               'deadline', 'timed out', 'timeout')
    return any(marker in message for marker in markers)


def parse_models():
    models = [settings.GEMINI_PARSE_MODEL, *settings.GEMINI_PARSE_FALLBACK_MODELS]
    return list(dict.fromkeys(model for model in models if model))


def _generate_json(model, contents, config):
    response = get_client().models.generate_content(model=model, contents=contents, config=config)
    return json.loads(response.text)


def understand_with_gemini(catalog, state, text=None, audio=None, mime_type=None, lang='uz'):
    """Hedged request: if the main model is slow or busy, the next model is asked in parallel
    and the first good answer wins (the API is sometimes overloaded for tens of seconds)."""
    from google.genai import types

    utterance = json.dumps(text, ensure_ascii=False) if text else '(AUDIO attached — transcribe it first)'
    contents = [_prompt(catalog, state, utterance, lang)]
    if audio:
        contents.append(types.Part.from_bytes(data=audio, mime_type=normalize_mime(mime_type)))
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type='application/json',
        response_json_schema=ORDER_SCHEMA,
        temperature=0.1,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        http_options=types.HttpOptions(timeout=(40 if audio else 20) * 1000),
    )

    models = parse_models()
    executor = ThreadPoolExecutor(max_workers=len(models))
    pending, errors = {}, []
    launched = 0
    deadline = time.monotonic() + (45 if audio else 25)

    def launch_next():
        nonlocal launched
        if launched < len(models):
            pending[executor.submit(_generate_json, models[launched], contents, config)] = models[launched]
            launched += 1
            return True
        return False

    try:
        launch_next()
        while pending:
            hedge = launched < len(models)
            timeout = settings.GEMINI_PARSE_HEDGE_SECONDS if hedge else max(deadline - time.monotonic(), 0.1)
            done, _ = wait(pending, timeout=timeout, return_when=FIRST_COMPLETED)
            if not done:
                if hedge:
                    logger.info('Gemini %s is slow, asking %s in parallel', models[launched - 1], models[launched])
                    launch_next()
                    continue
                errors.append(TimeoutError('no model answered in time'))
                break
            for future in done:
                model = pending.pop(future)
                try:
                    return future.result()
                except Exception as exc:
                    logger.warning('Gemini order parsing failed on %s: %s', model, exc)
                    errors.append(exc)
                    if not (is_transient(exc) or isinstance(exc, ValueError)):
                        raise VoiceError('ai_failed', str(exc))  # e.g. invalid key — other models will not help
                    if not pending:
                        launch_next()
        raise VoiceError('ai_failed', str(errors[-1]) if errors else 'no answer')
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


# ---------------------------------------------------------------------------
# Local fallback parser (no API key): good enough for clear, structured dictation
# ---------------------------------------------------------------------------

NUMBER_WORDS = {
    'bir': 1, 'bitta': 1, 'ikki': 2, 'ikkita': 2, 'uch': 3, 'uchta': 3, "to'rt": 4, "to'rtta": 4,
    'besh': 5, 'beshta': 5, 'olti': 6, 'oltita': 6, 'yetti': 7, 'yettita': 7, 'sakkiz': 8, 'sakkizta': 8,
    "to'qqiz": 9, "to'qqizta": 9, "o'n": 10, "o'nta": 10,
    'один': 1, 'одна': 1, 'одну': 1, 'одно': 1, 'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5,
    'шесть': 6, 'семь': 7, 'восемь': 8, 'девять': 9, 'десять': 10,
}
ADD_WORDS = {'yana', 'ещё', 'еще', 'plus'}
REMOVE_PHRASES = ('olib tashla', "o'chir", 'kerak emas', 'kerakmas', 'убери', 'удали', 'не надо', 'убрать')
SUBMIT_PHRASES = ('yarat', 'saqla', 'tasdiqla', 'rasmiylashtir', 'создай', 'сохрани', 'оформи', 'подтверди')
CLEAR_PHRASES = ('hammasini tozala', 'hammasini o\'chir', 'yangidan', 'очисти', 'сбрось')
PICKUP_PHRASES = ('olib ketadi', 'olib ketish', "o'zi oladi", 'zalda', 'самовывоз', 'заберет', 'заберёт')
DELIVERY_PHRASES = ('yetkazib', 'dostavka', 'доставк')
CASH_PHRASES = ('naqd', 'naqt', 'наличн')
CARD_PHRASES = ('karta', 'plastik', 'click', 'payme', 'карт', 'перевод')
COMPLETED_PHRASES = ('sotildi', 'berildi', 'yakunlandi', 'topshirildi', 'выдан', 'оплачен')
ON_THE_WAY_PHRASES = ("yo'lda", 'в пути')
FIELD_STOP = (
    r"(?=,|\.|;|\s+(?:telefon|tel|raqam|nomer|mijoz|ismi|manzil|izoh|naqd|naqt|karta|plastik|yetkazib|olib|"
    r"телефон|номер|клиент|имя|адрес|комментарий|наличн|карт|доставк|самовывоз)\b|$)"
)


def _normalize(text):
    text = str(text or '').lower()
    text = re.sub(r"[ʻʼ’‘`´]", "'", text)
    return re.sub(r'\s+', ' ', text).strip()


def _tokens(text):
    return re.findall(r"[\w']+", text)


COUNTER_WORDS = ('ta', 'dona', 'shtuk', 'штуки', 'штук', 'шт')


def _as_number(token):
    token = token.strip("'")
    if token in NUMBER_WORDS:
        return NUMBER_WORDS[token]
    match = re.fullmatch(r'x?(\d{1,2})(?:ta|x|шт)?', token)
    return int(match.group(1)) if match else None


def _number_before(tokens, start):
    """"ikkita chizburger", "2 ta chizburger" -> (quantity, token indexes)"""
    if start >= 1 and _as_number(tokens[start - 1]):
        return _as_number(tokens[start - 1]), {start - 1}
    if start >= 2 and tokens[start - 1] in COUNTER_WORDS and _as_number(tokens[start - 2]):
        return _as_number(tokens[start - 2]), {start - 2, start - 1}
    return None


def _number_after(tokens, end):
    """"chizburger 2 ta", "chizburger x2", "чизбургер две штуки" -> (quantity, token indexes)"""
    if end < len(tokens) and _as_number(tokens[end]):
        indexes = {end}
        if end + 1 < len(tokens) and tokens[end + 1] in COUNTER_WORDS:
            indexes.add(end + 1)
        return _as_number(tokens[end]), indexes
    return None


def _assign_quantities(tokens, matches):
    """A number between two products could belong to either one, so follow the operator's style
    ("2 ta burger" vs "burger 2 ta") and never use the same number twice."""
    before = [_number_before(tokens, start) for start, _end, *_ in matches]
    after = [_number_after(tokens, end) for _start, end, *_ in matches]
    prefer_after = sum(1 for value in after if value) > sum(1 for value in before if value)

    quantities, used = [], set()
    for index in range(len(matches)):
        options = (after[index], before[index]) if prefer_after else (before[index], after[index])
        quantity = None
        for option in options:
            if option and not option[1] & used:
                quantity = option[0]
                used |= option[1]
                break
        quantities.append(quantity)
    return quantities


def _find_products(text, catalog):
    tokens = _tokens(text)
    candidates = []
    for product in catalog:
        for name in {_normalize(product['uz']), _normalize(product['ru'])}:
            name_tokens = _tokens(name)
            if not name_tokens:
                continue
            for size in {len(name_tokens), len(name_tokens) + 1}:
                for start in range(0, max(len(tokens) - size + 1, 0)):
                    window = ' '.join(tokens[start:start + size])
                    # Allow Uzbek plural/case endings: "chizburgerlar", "chizburgerni"
                    window_stem = re.sub(r"(lar|ni|ga|dan|ы|и|а|ов)$", '', window)
                    score = max(SequenceMatcher(None, window, name).ratio(),
                                SequenceMatcher(None, window_stem, name).ratio())
                    if score >= 0.84:
                        candidates.append((score, start, start + size, product['id']))

    matches, used = [], set()
    for score, start, end, product_id in sorted(candidates, key=lambda c: (-c[0], c[1])):
        span = set(range(start, end))
        if span & used or any(match[3] == product_id for match in matches):
            continue
        used |= span
        matches.append((start, end, score, product_id))
    return tokens, sorted(matches)


def _match_phrase(text, phrases):
    return any(phrase in text for phrase in phrases)


def local_understand(catalog, state, text):
    raw = str(text or '').strip()
    norm = _normalize(raw)
    result = {field: state.get(field, '') or '' for field in FORM_FIELDS}
    items = {int(item['product_id']): int(item['quantity']) for item in state.get('items', [])}

    if _match_phrase(norm, CLEAR_PHRASES):
        return {**{field: '' for field in FORM_FIELDS}, 'items': [], 'unmatched': [], 'submit': False,
                'transcript': raw, 'reply': ''}

    tokens, matches = _find_products(norm, catalog)
    for (start, end, _score, product_id), quantity in zip(matches, _assign_quantities(tokens, matches)):
        context = ' '.join(tokens[max(start - 3, 0):min(end + 3, len(tokens))])
        if _match_phrase(context, REMOVE_PHRASES):
            items.pop(product_id, None)
            continue
        adding = any(word in tokens[max(start - 3, 0):start] for word in ADD_WORDS)
        items[product_id] = min((items.get(product_id, 0) if adding else 0) + (quantity or 1), MAX_QUANTITY)

    phone_match = re.search(r'(\+?\d[\d\s\-()]{7,}\d)', raw)
    if phone_match:
        phone = normalize_phone(phone_match.group(1))
        if phone:
            result['phone'] = phone

    name_match = re.search(
        r"(?:mijoz(?:ning)?(?:\s+ismi)?|ismi|клиент(?:а)?|имя|для)\s*[:\-]?\s*([A-Za-zА-Яа-яЁё'ʻ’]{2,})", raw, re.I
    ) or re.search(r"\b([A-Za-z'ʻ’]{2,})\s+(?:akaga|opaga|akaning|opaning)\b", raw, re.I)
    if name_match:
        result['customer_name'] = name_match.group(1).strip("'").capitalize()

    address_match = re.search(r'(?:manzil(?:i)?|адрес)\s*[:\-]?\s*(.+?)' + FIELD_STOP, raw, re.I)
    if address_match and address_match.group(1).strip():
        result['address'] = address_match.group(1).strip(' ,.')
        result['delivery_type'] = 'delivery'

    comment_match = re.search(r'(?:izoh|комментарий|примечание)\s*[:\-]?\s*(.+?)' + FIELD_STOP, raw, re.I)
    if comment_match and comment_match.group(1).strip():
        result['comment'] = comment_match.group(1).strip(' ,.')

    if _match_phrase(norm, PICKUP_PHRASES):
        result['delivery_type'] = 'pickup'
    elif _match_phrase(norm, DELIVERY_PHRASES):
        result['delivery_type'] = 'delivery'
    if _match_phrase(norm, CASH_PHRASES):
        result['payment_method'] = 'cash'
    elif _match_phrase(norm, CARD_PHRASES):
        result['payment_method'] = 'card'
    if _match_phrase(norm, COMPLETED_PHRASES):
        result['status'] = 'completed'
    elif _match_phrase(norm, ON_THE_WAY_PHRASES):
        result['status'] = 'on_the_way'

    return {
        **result,
        'items': [{'product_id': product_id, 'quantity': quantity} for product_id, quantity in items.items()],
        'unmatched': [],
        'submit': _match_phrase(norm, SUBMIT_PHRASES),
        'transcript': raw,
        'reply': '',
    }


# ---------------------------------------------------------------------------
# public API
# ---------------------------------------------------------------------------

def clean_state(state):
    state = state if isinstance(state, dict) else {}
    items = []
    for item in state.get('items') or []:
        try:
            items.append({'product_id': int(item['product_id']), 'quantity': max(1, int(item['quantity']))})
        except (KeyError, TypeError, ValueError):
            continue
    return {**{field: str(state.get(field) or '')[:300] for field in FORM_FIELDS}, 'items': items}


def sanitize(result, catalog):
    """Never trust model output: keep known product ids, clamp quantities, validate choices."""
    known_ids = {item['id'] for item in catalog}
    items = {}
    for item in result.get('items') or []:
        try:
            product_id, quantity = int(item.get('product_id')), int(item.get('quantity') or 1)
        except (TypeError, ValueError, AttributeError):
            continue
        if product_id in known_ids and quantity > 0:
            items[product_id] = min(items.get(product_id, 0) + quantity, MAX_QUANTITY)

    clean = {field: str(result.get(field) or '').strip()[:300] for field in FORM_FIELDS}
    for field, allowed in CHOICES.items():
        if clean[field] not in allowed:
            clean[field] = ''
    if clean['phone']:
        clean['phone'] = normalize_phone(clean['phone']) or clean['phone']
    return {
        **clean,
        'items': [{'product_id': product_id, 'quantity': quantity} for product_id, quantity in items.items()],
        'unmatched': [str(value)[:100] for value in (result.get('unmatched') or []) if str(value).strip()][:10],
        'submit': bool(result.get('submit')),
        'reply': str(result.get('reply') or '').strip()[:300],
        'transcript': str(result.get('transcript') or '').strip()[:2000],
    }


def understand(catalog, state, text=None, audio=None, mime_type=None, lang='uz', live_text=None):
    """Returns (result, engine). Raises VoiceError.

    With audio, the complete recording is transcribed and used — live captions (`live_text`) may miss the
    first words (said before the stream connected) or the last ones, so they are only a fallback."""
    state = clean_state(state)
    text = (text or '').strip()
    live_text = (live_text or '').strip()

    if not is_configured():
        if not text:
            raise VoiceError('not_configured')
        return sanitize(local_understand(catalog, state, text), catalog), 'local'

    if audio and not text:
        try:
            text = transcribe(audio, mime_type, catalog)
        except VoiceError:
            if not live_text:
                # Last resort: a single multimodal call that transcribes and extracts at once.
                result = understand_with_gemini(catalog, state, audio=audio, mime_type=mime_type, lang=lang)
                return sanitize(result, catalog), 'gemini'
        text = text or live_text
        if not text:
            raise VoiceError('empty_transcript')

    result = understand_with_gemini(catalog, state, text=text, lang=lang)
    result['transcript'] = text
    return sanitize(result, catalog), 'gemini'
