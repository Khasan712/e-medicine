"""Bot tokens are stored encrypted (Fernet) with a key derived from SECRET_KEY — exactly as the backend does
(apps.platform.crypto), so either side can read what the other wrote."""
import base64
import hashlib

from cryptography.fernet import Fernet

from .config import settings


def _fernet():
    digest = hashlib.sha256(f'hub.bot-tokens:{settings.secret_key}'.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(value):
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value):
    """Raises cryptography.fernet.InvalidToken when SECRET_KEY changed (the bot has to be connected again)."""
    return _fernet().decrypt(value.encode()).decode()
