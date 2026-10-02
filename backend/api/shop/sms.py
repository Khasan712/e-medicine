"""Delivery of phone sign-in codes. The backend is chosen with the SMS_BACKEND setting:
console (development: the code goes to the log), eskiz (Eskiz.uz SMS) or telegram_gateway (Telegram Gateway API)."""
import logging

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger('api')

ESKIZ_API = 'https://notify.eskiz.uz/api'
TELEGRAM_GATEWAY_API = 'https://gatewayapi.telegram.org/sendVerificationMessage'


class SmsError(Exception):
    pass


def send_code(phone, code, shop_name):
    backend = settings.SMS_BACKEND
    if backend == 'eskiz':
        _send_eskiz(phone, code, shop_name)
    elif backend == 'telegram_gateway':
        _send_telegram_gateway(phone, code)
    else:
        logger.warning('[SMS console] sign-in code for %s: %s', phone, code)


def _eskiz_token(refresh=False):
    token = None if refresh else cache.get('eskiz_token')
    if token:
        return token
    try:
        response = requests.post(
            f'{ESKIZ_API}/auth/login',
            data={'email': settings.ESKIZ_EMAIL, 'password': settings.ESKIZ_PASSWORD},
            timeout=10,
        )
        response.raise_for_status()
        token = response.json()['data']['token']
    except (requests.RequestException, KeyError, ValueError) as exc:
        raise SmsError(f'Eskiz login failed: {exc}')
    cache.set('eskiz_token', token, 60 * 60 * 24 * 25)  # Eskiz tokens live ~30 days
    return token


def _send_eskiz(phone, code, shop_name):
    payload = {
        'mobile_phone': phone.lstrip('+'),
        'message': settings.ESKIZ_MESSAGE.format(shop=shop_name, code=code),
        'from': settings.ESKIZ_FROM,
    }
    for refresh in (False, True):
        headers = {'Authorization': f'Bearer {_eskiz_token(refresh=refresh)}'}
        try:
            response = requests.post(f'{ESKIZ_API}/message/sms/send', data=payload, headers=headers, timeout=10)
        except requests.RequestException as exc:
            raise SmsError(f'Eskiz send failed: {exc}')
        if response.status_code == 401 and not refresh:
            continue  # the token expired — sign in again once
        if response.ok:
            return
        raise SmsError(f'Eskiz send failed: {response.status_code} {response.text[:200]}')


def _send_telegram_gateway(phone, code):
    """The code arrives as a Telegram message from the "Verification Codes" chat."""
    try:
        response = requests.post(
            TELEGRAM_GATEWAY_API,
            json={'phone_number': phone, 'code': code, 'ttl': 300},
            headers={'Authorization': f'Bearer {settings.TELEGRAM_GATEWAY_TOKEN}'},
            timeout=10,
        )
        data = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise SmsError(f'Telegram Gateway failed: {exc}')
    if not data.get('ok'):
        raise SmsError(f'Telegram Gateway error: {data.get("error")}')
