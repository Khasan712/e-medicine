"""Customer authentication for the web shop.

Customers are `app.Client` rows (the same table the Telegram bot uses), not Django users.
The API is authenticated with a signed bearer token so it also works inside the Telegram
Mini App iframe (Telegram Web/Desktop), where cookies are not reliable.
"""
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from django.conf import settings
from django.core import signing

from app.models import Client

TOKEN_SALT = 'shop.client-token'
TOKEN_MAX_AGE = 60 * 60 * 24 * 90  # 90 days
INIT_DATA_MAX_AGE = 60 * 60 * 24  # Telegram initData older than a day is rejected


def issue_token(client):
    return signing.dumps({'cid': client.pk}, salt=TOKEN_SALT)


def get_request_client(request):
    header = request.headers.get('Authorization', '')
    if not header.startswith('Bearer '):
        return None
    try:
        data = signing.loads(header[7:].strip(), salt=TOKEN_SALT, max_age=TOKEN_MAX_AGE)
    except signing.BadSignature:
        return None
    return Client.objects.filter(pk=data.get('cid')).first()


def _init_data_hash(fields, secret_key):
    data_check_string = '\n'.join(f'{key}={value}' for key, value in sorted(fields.items()))
    return hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()


def validate_webapp_init_data(init_data, bot_token=None, max_age=INIT_DATA_MAX_AGE):
    """Validate `Telegram.WebApp.initData` (https://core.telegram.org/bots/webapps).

    Returns the parsed payload (with `user` decoded) or None when the signature is invalid or stale.
    """
    bot_token = bot_token or settings.TELEGRAM_BOT_TOKEN
    if not init_data or not bot_token:
        return None
    try:
        fields = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=True))
    except ValueError:
        return None

    received_hash = fields.pop('hash', '')
    if not received_hash:
        return None

    secret_key = hmac.new(b'WebAppData', bot_token.encode(), hashlib.sha256).digest()
    valid = hmac.compare_digest(_init_data_hash(fields, secret_key), received_hash)
    if not valid and 'signature' in fields:
        # Clients differ on whether the Ed25519 `signature` field takes part in the HMAC check.
        without_signature = {key: value for key, value in fields.items() if key != 'signature'}
        valid = hmac.compare_digest(_init_data_hash(without_signature, secret_key), received_hash)
    if not valid:
        return None

    try:
        auth_date = int(fields.get('auth_date', 0))
    except ValueError:
        return None
    if max_age and time.time() - auth_date > max_age:
        return None

    try:
        fields['user'] = json.loads(fields['user']) if fields.get('user') else None
    except ValueError:
        return None
    return fields
