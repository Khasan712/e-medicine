"""Telegram Mini App sign-in: checking `Telegram.WebApp.initData` (https://core.telegram.org/bots/webapps)."""
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

INIT_DATA_MAX_AGE = 60 * 60 * 24  # initData older than a day is rejected


def _init_data_hash(fields, secret_key):
    data_check_string = '\n'.join(f'{key}={value}' for key, value in sorted(fields.items()))
    return hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()


def validate_init_data(init_data, bot_token, max_age=INIT_DATA_MAX_AGE):
    """The parsed payload (with `user` decoded) when initData was signed with `bot_token` and is fresh,
    otherwise None."""
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


def telegram_user(init_data, bot_token):
    """The `user` object of valid initData, or None."""
    payload = validate_init_data(init_data, bot_token)
    user = (payload or {}).get('user')
    return user if isinstance(user, dict) and user.get('id') else None
