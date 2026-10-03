"""Bots of a business: connecting one with a @BotFather token, setup links for our platform bot (Telegram Managed
Bots: the owner creates both bots in two taps) and whether the bot service serves a bot right now. The bot service
picks a connected bot up within seconds, configures it (commands, descriptions, Mini App button) and polls it."""
import hashlib
import logging
import secrets
from datetime import timedelta

from cryptography.fernet import InvalidToken
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .models import BotSetup, BusinessBot
from .telegram_api import TelegramError, call, get_me

logger = logging.getLogger('platform')

ROLES = (BusinessBot.ROLE_CLIENT, BusinessBot.ROLE_ADMIN)
SETUP_TTL = timedelta(days=7)
# The bot service marks every bot it polls (BusinessBot.last_seen_at) every 30 seconds.
HEARTBEAT_ALIVE = timedelta(seconds=90)


class BotInUse(ValueError):
    """The bot already serves another business or role."""


def is_alive(bot):
    return bool(bot and bot.last_seen_at and timezone.now() - bot.last_seen_at < HEARTBEAT_ALIVE)


def connect_bot(business, role, token, created_via=BusinessBot.VIA_TOKEN, owner_telegram_id=None):
    """Checks the token (getMe) and stores it encrypted. Raises TelegramError for a bad token and BotInUse
    when the bot already belongs elsewhere."""
    token = token.strip()
    me = get_me(token)
    taken = BusinessBot.objects.filter(telegram_id=me['id']).exclude(business=business, role=role).first()
    if taken:
        raise BotInUse(str(taken))
    bot = BusinessBot.objects.filter(business=business, role=role).first() or BusinessBot(business=business, role=role)
    bot.telegram_id = me['id']
    bot.username = me.get('username') or ''
    bot.name = me.get('first_name') or ''
    bot.token = token
    bot.created_via = created_via
    bot.owner_telegram_id = owner_telegram_id
    bot.is_active = True
    bot.last_seen_at = None
    bot.save()
    logger.info('@%s connected to %s as the %s bot', bot.username, business, role)
    return bot


# What the bot service set up (the Mini App button; commands and descriptions in the default language and in
# Russian), undone when a bot leaves the platform: the bot stays its owner's, it just stops speaking for us.
RELEASE_CALLS = (
    ('setChatMenuButton', {'menu_button': {'type': 'default'}}),
    ('deleteMyCommands', {}),
    ('deleteMyCommands', {'language_code': 'ru'}),
    ('setMyDescription', {'description': ''}),  # an empty text removes it
    ('setMyDescription', {'description': '', 'language_code': 'ru'}),
    ('setMyShortDescription', {'short_description': ''}),
    ('setMyShortDescription', {'short_description': '', 'language_code': 'ru'}),
)
# The other calls would fail the same way: Telegram out of reach (no code), the token revoked or the bot deleted.
GIVE_UP = (None, 401, 404)


def release_bot(bot):
    """Best effort: a bot leaving the platform (disconnected, or its business deleted) stops pointing at us.
    A token that cannot be read, Telegram out of reach or a dead token only skip the clean-up.

    A bot created through our platform bot (Telegram Managed Bots) stays managed by it on Telegram's side: the Bot API
    gives a manager no way to let a bot go. Nothing of ours polls or configures it any more, and its owner can
    delete it in @BotFather. Its token is not replaced either: the manager could fetch the new one anyway, and the
    managed_bot update that follows would reach our platform bot as an unknown bot."""
    try:
        token = bot.token
    except InvalidToken:
        return
    for method, payload in RELEASE_CALLS:
        try:
            call(token, method, payload, timeout=5)
        except TelegramError as exc:
            logger.warning('@%s: %s failed while releasing the bot: %s', bot.username, method, exc.description)
            if exc.code in GIVE_UP:
                return


def missing_roles(business):
    connected = set(business.bots.filter(is_active=True).values_list('role', flat=True))
    return [role for role in ROLES if role not in connected]


def platform_bot():
    """getMe of our platform bot (cached), or None when PLATFORM_BOT_TOKEN is empty or wrong."""
    if not settings.PLATFORM_BOT_TOKEN:
        return None
    me = cache.get('platform_bot_me')
    if me is None:
        try:
            me = get_me(settings.PLATFORM_BOT_TOKEN) or {}
        except TelegramError as exc:
            logger.warning('Platform bot getMe failed: %s', exc)
            me = {}
        cache.set('platform_bot_me', me, 60 * 10 if me else 60)
    return me or None


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_setup_link(business):
    """(url, setup) — t.me/<platform bot>?start=setup_<token>; whoever opens it creates the business's bots.
    None without a platform bot. Only a hash of the token is stored."""
    me = platform_bot()
    if not me or not me.get('username'):
        return None
    token = secrets.token_urlsafe(18)
    setup = BotSetup.objects.create(business=business, token_hash=hash_token(token),
                                    expires_at=timezone.now() + SETUP_TTL)
    return f'https://t.me/{me["username"]}?start=setup_{token}', setup
