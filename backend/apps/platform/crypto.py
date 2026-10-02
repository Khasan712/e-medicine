"""Bot tokens are stored encrypted (Fernet) with a key derived from SECRET_KEY.
Changing SECRET_KEY makes the stored tokens unreadable: the bots then have to be connected again."""
import base64
import hashlib

from cryptography.fernet import Fernet
from django.conf import settings


def _fernet():
    digest = hashlib.sha256(f'hub.bot-tokens:{settings.SECRET_KEY}'.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(value):
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value):
    return _fernet().decrypt(value.encode()).decode()
