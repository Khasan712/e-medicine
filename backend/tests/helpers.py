import hashlib
import hmac
import io
import json
import time
from urllib.parse import urlencode

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.core.models import Category, Descriptions, Product

BOT_TOKEN = '123456:TEST-TOKEN'


def signed_init_data(user, bot_token=BOT_TOKEN, auth_date=None, extra=None, sign_signature=True):
    """Telegram.WebApp.initData as Telegram signs it with the bot token."""
    fields = {'auth_date': str(auth_date or int(time.time())), 'query_id': 'AAE', 'user': json.dumps(user)}
    fields.update(extra or {})
    signed = fields if sign_signature else {k: v for k, v in fields.items() if k != 'signature'}
    secret = hmac.new(b'WebAppData', bot_token.encode(), hashlib.sha256).digest()
    check_string = '\n'.join(f'{k}={v}' for k, v in sorted(signed.items()))
    fields['hash'] = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def png(name='photo.png', color=(255, 107, 0)):
    buffer = io.BytesIO()
    Image.new('RGB', (4, 4), color).save(buffer, format='PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


def make_catalog():
    """A unit, a category and two products (prices stored as text, the way old data has them)."""
    unit = Descriptions.objects.create(name_uz='dona', name_ru='шт')
    category = Category.objects.create(name_uz='Burgerlar', name_ru='Бургеры')
    burger = Product.objects.create(name_uz='Chizburger', name_ru='Чизбургер', price='35 000', desc_uz='-',
                                    desc_ru='-', measure=unit, category=category, img='products/none.jpg')
    cola = Product.objects.create(name_uz='Kola', name_ru='Кола', price='12 000 UZS', desc_uz='-', desc_ru='-',
                                  measure=unit)
    return unit, category, burger, cola
