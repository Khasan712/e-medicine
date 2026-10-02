"""The few Bot API calls the backend makes itself (checking a bot token). Everything else that talks to
Telegram lives in the bot service."""
import requests
from django.conf import settings


class TelegramError(Exception):
    def __init__(self, method, description='', code=None):
        super().__init__(f'{method}: {description}')
        self.method = method
        self.description = description or ''
        self.code = code


def call(token, method, payload=None, timeout=10):
    url = f'{settings.TELEGRAM_API_URL.rstrip("/")}/bot{token}/{method}'
    try:
        data = requests.post(url, json=payload or {}, timeout=timeout).json()
    except (requests.RequestException, ValueError) as exc:
        # Request errors contain the URL, and the URL contains the token.
        raise TelegramError(method, str(exc).replace(token, '<token>')) from None
    if not data.get('ok'):
        raise TelegramError(method, data.get('description', ''), data.get('error_code'))
    return data.get('result')


def get_me(token):
    return call(token, 'getMe')
