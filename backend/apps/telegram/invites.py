"""Staff accounts and the business's staff bot, as the admin panel sees them: invite links (QR) that connect
a Telegram account to a dashboard user, and whether the bot is up. The bot service redeems the invites."""
import hashlib
import secrets
from datetime import timedelta

from django.utils import timezone

from apps.platform.bots import is_alive  # noqa: F401 (part of this module's interface)
from apps.platform.current import business_bot
from apps.platform.models import BusinessBot
from .models import StaffInvite, StaffLink

INVITE_TTL = timedelta(hours=24)


def admin_bot():
    return business_bot(BusinessBot.ROLE_ADMIN)


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_invite(user, created_by):
    """Returns (token, invite). A user may have several open invites (people sharing one account connect
    their own phones); each works once and expires after INVITE_TTL."""
    StaffInvite.objects.filter(expires_at__lt=timezone.now()).delete()
    token = secrets.token_urlsafe(18)
    invite = StaffInvite.objects.create(
        token_hash=hash_token(token), user=user, created_by=created_by, expires_at=timezone.now() + INVITE_TTL,
    )
    return token, invite


def invite_url(token):
    bot = admin_bot()
    return f'https://t.me/{bot.username}?start=inv_{token}' if bot else None


def find_staff(telegram_id):
    """The staff link of a Telegram account whose dashboard user is still active, or None."""
    if not telegram_id:
        return None
    link = StaffLink.objects.select_related('user').filter(telegram_id=telegram_id).first()
    if link and link.user.is_active and not link.user.is_deleted:
        return link
    return None
