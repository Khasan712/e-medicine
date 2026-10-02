"""Our platform bot: creates the Telegram bots of a business with Telegram Managed Bots.

The panel gives a link t.me/<platform bot>?start=setup_<token> (hub_botsetup). Whoever opens it — the owner or
our staff — taps two buttons and Telegram creates the customers' bot and the staff bot; the bots are owned by
that person, their tokens come to us (getManagedBotToken) and are stored encrypted; the runtime starts and
configures the new bots within seconds. The platform bot must be allowed to manage bots in @BotFather.
Runs in the public schema; the feed brings `db` and `bot_factory` (Bot objects for the new tokens)."""
import asyncio
import hashlib
import hmac
import logging
from html import escape
from urllib.parse import quote

from aiogram import Bot, Dispatcher, F, Router
from aiogram.enums import ChatType
from aiogram.exceptions import TelegramAPIError
from aiogram.types import (
    CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, KeyboardButtonRequestManagedBot,
    ManagedBotUpdated, Message, ReplyKeyboardMarkup, ReplyKeyboardRemove,
)
from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert

from app.businesses import BusinessInfo
from app.config import settings
from app.crypto import encrypt
from app.db.models import BotSetup, Business, BusinessBot, StaffLink, User
from app.telegram import api
from app.telegram.filters import TextCommand
from app.utils import now
from .texts import language_of, t

logger = logging.getLogger('platform')

ROLES = (BusinessBot.ROLE_CLIENT, BusinessBot.ROLE_ADMIN)
# Network errors while attaching a new bot are retried at once; after that the creator gets a retry button.
CONNECT_ATTEMPTS = 3
sleep = asyncio.sleep  # the tests do not wait


class BotInUse(ValueError):
    """The bot already serves another business or role."""


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def suggested(business, role):
    base = business.slug.replace('-', '_')
    if role == BusinessBot.ROLE_CLIENT:
        return f'{base}_bot', business.name
    return f'{base}_admin_bot', f'{business.name} Admin'


def retry_signature(bot_id, role, user_id):
    message = f'{bot_id}:{role}:{user_id}'.encode()
    return hmac.new(settings.secret_key.encode(), message, hashlib.sha256).hexdigest()[:12]


def retry_data(bot_id, role, user_id):
    """Callback data of the retry button, signed: only its creator can attach that bot."""
    return f'retry:{bot_id}:{role}:{retry_signature(bot_id, role, user_id)}'


# ---------------------------------------------------------------------------
# data
# ---------------------------------------------------------------------------

async def missing_roles(session, business_id):
    connected = set((await session.scalars(
        select(BusinessBot.role).where(BusinessBot.business_id == business_id, BusinessBot.is_active.is_(True))
    )).all())
    return [role for role in ROLES if role not in connected]


async def active_setup(session, telegram_user_id):
    """The newest unexpired setup link opened by this Telegram user: (BotSetup, BusinessInfo) or None."""
    if not telegram_user_id:
        return None
    row = (await session.execute(
        select(BotSetup, Business).join(Business, Business.id == BotSetup.business_id)
        .where(BotSetup.telegram_user_id == telegram_user_id, BotSetup.expires_at > now())
        .order_by(BotSetup.created_at.desc(), BotSetup.id.desc()).limit(1)
    )).first()
    return (row[0], BusinessInfo.of(row[1])) if row else None


async def connect_bot(session, bot_factory, business, role, token, created_via=BusinessBot.VIA_TOKEN,
                      owner_telegram_id=None):
    """Checks the token (getMe) and stores it encrypted (committed). Raises TelegramAPIError for a bad token
    and BotInUse when the bot already belongs elsewhere."""
    token = token.strip()
    me = await bot_factory.make(token).get_me(request_timeout=10)
    taken = await session.scalar(select(BusinessBot).where(
        BusinessBot.telegram_id == me.id, or_(BusinessBot.business_id != business.id, BusinessBot.role != role)))
    if taken:
        raise BotInUse(f'@{taken.username}')
    bot = await session.scalar(select(BusinessBot).where(BusinessBot.business_id == business.id,
                                                         BusinessBot.role == role))
    if bot is None:
        bot = BusinessBot(business_id=business.id, role=role, created_at=now())
        session.add(bot)
    bot.telegram_id = me.id
    bot.username = me.username or ''
    bot.name = me.first_name or ''
    bot.token_encrypted = encrypt(token)
    bot.created_via = created_via
    bot.owner_telegram_id = owner_telegram_id
    bot.is_active = True
    bot.last_seen_at = None
    await session.commit()
    logger.info('@%s connected to %s as the %s bot', bot.username, business.name, role)
    return bot


async def link_owner(db, business, creator, lang):
    """Whoever created the staff bot uses it right away, as the business's first admin account."""
    async with db.tenant(business.schema_name) as session:
        owner = await session.scalar(
            select(User).where(User.role == 'admin', User.is_active.is_(True), User.is_deleted.is_(False))
            .order_by(User.id).limit(1)
        )
        if owner is None:
            return
        statement = insert(StaffLink).values(
            telegram_id=creator.id, user_id=owner.id, first_name=(creator.first_name or '')[:150],
            username=(creator.username or '')[:100], lang=lang, notify_orders=True, blocked_at=None,
            created_at=now(), last_seen_at=None,
        )
        await session.execute(statement.on_conflict_do_update(index_elements=[StaffLink.telegram_id], set_={
            'user_id': owner.id, 'first_name': statement.excluded.first_name,
            'username': statement.excluded.username, 'lang': lang, 'blocked_at': None,
        }))
        await session.commit()


# ---------------------------------------------------------------------------
# steps
# ---------------------------------------------------------------------------

async def send_next_step(bot: Bot, db, chat_id, business, lang):
    async with db.public() as session:
        missing = await missing_roles(session, business.id)
        rows = (await session.execute(select(BusinessBot.role, BusinessBot.username).where(
            BusinessBot.business_id == business.id, BusinessBot.is_active.is_(True)))).all()
    if not missing:
        bots = {role: username for role, username in rows}
        return await api.send(bot, chat_id, t(
            lang, 'done', business=escape(business.name), client=bots.get(BusinessBot.ROLE_CLIENT, '—'),
            admin=bots.get(BusinessBot.ROLE_ADMIN, '—'), shop=business.shop_url, panel=business.admin_url,
        ), ReplyKeyboardRemove(remove_keyboard=True))
    role = missing[0]
    username, name = suggested(business, role)
    try:
        me = await bot.me()
        platform_username = me.username or ''
    except TelegramAPIError:
        platform_username = ''
    link = f'https://t.me/newbot/{platform_username}/{username}?name={quote(name)}'
    button = KeyboardButton(text=t(lang, f'btn_{role}'), request_managed_bot=KeyboardButtonRequestManagedBot(
        request_id=ROLES.index(role) + 1, suggested_name=name, suggested_username=username,
    ))
    await api.send(bot, chat_id, t(lang, f'step_{role}', username=username, link=link),
                   ReplyKeyboardMarkup(keyboard=[[button]], resize_keyboard=True, one_time_keyboard=True))


async def attach(bot: Bot, db, bot_factory, business, bot_id, role, creator):
    """Takes the token of a bot created through us and connects it. Network errors are retried; an answer of
    the Bot API (e.g. 400) is final."""
    for attempt in range(CONNECT_ATTEMPTS):
        try:
            token = await bot.get_managed_bot_token(user_id=bot_id)
            async with db.public() as session:
                return await connect_bot(session, bot_factory, business, role, token,
                                         created_via=BusinessBot.VIA_MANAGED, owner_telegram_id=creator.id)
        except TelegramAPIError as exc:
            if not api.is_network(exc) or attempt == CONNECT_ATTEMPTS - 1:
                raise
            await sleep(2 * (attempt + 1))


async def finish(bot: Bot, db, business, connected, creator, lang):
    if connected.role == BusinessBot.ROLE_ADMIN:
        await link_owner(db, business, creator, lang)
    await api.send(bot, creator.id, t(lang, 'connected', username=connected.username))
    await send_next_step(bot, db, creator.id, business, lang)


# ---------------------------------------------------------------------------
# updates
# ---------------------------------------------------------------------------

async def on_setup(message: Message, bot: Bot, db, argument: str):
    """/start setup_<token> — the link from our panel."""
    sender = message.from_user
    lang = language_of(sender)
    async with db.public() as session:
        row = (await session.execute(
            select(BotSetup, Business).join(Business, Business.id == BotSetup.business_id)
            .where(BotSetup.token_hash == hash_token(argument[6:]), BotSetup.expires_at > now())
        )).first()
        if row:
            row[0].telegram_user_id = sender.id
            await session.commit()
    if not row:
        return await api.send(bot, message.chat.id, t(lang, 'invalid'))
    business = BusinessInfo.of(row[1])
    await api.send(bot, message.chat.id, t(lang, 'start', business=escape(business.name)))
    await send_next_step(bot, db, message.chat.id, business, lang)


async def on_bot_created(message: Message):
    """The new bot itself arrives as a managed_bot update."""


async def on_message(message: Message, bot: Bot):
    await api.send(bot, message.chat.id, t(language_of(message.from_user), 'hello'))


async def on_managed_bot(event: ManagedBotUpdated, bot: Bot, db, bot_factory):
    creator, created = event.user, event.bot_user
    lang = language_of(creator)
    async with db.public() as session:
        known = await session.scalar(select(BusinessBot).where(BusinessBot.telegram_id == created.id))
        if known:  # its token or owner changed
            known.token_encrypted = encrypt(await bot.get_managed_bot_token(user_id=created.id))
            known.owner_telegram_id = creator.id
            await session.commit()
            return
        found = await active_setup(session, creator.id)
        missing = await missing_roles(session, found[1].id) if found else []
    if not found:
        return await api.send(bot, creator.id, t(lang, 'unknown_bot'))
    business = found[1]
    if not missing:
        return await send_next_step(bot, db, creator.id, business, lang)
    admin_name = 'admin' in (created.username or '').lower()
    role = BusinessBot.ROLE_ADMIN if admin_name and BusinessBot.ROLE_ADMIN in missing else missing[0]
    try:
        connected = await attach(bot, db, bot_factory, business, created.id, role, creator)
    except BotInUse:
        return await api.send(bot, creator.id, t(lang, 'in_use'))
    except TelegramAPIError as exc:
        logger.warning('Managed bot @%s of %s: %s', created.username, business.name, api.describe(exc))
        retry = InlineKeyboardButton(text=t(lang, 'btn_retry'), callback_data=retry_data(created.id, role, creator.id))
        return await api.send(bot, creator.id, t(lang, 'failed', username=created.username or ''),
                              InlineKeyboardMarkup(inline_keyboard=[[retry]]))
    await finish(bot, db, business, connected, creator, lang)


async def on_callback(query: CallbackQuery, bot: Bot, db, bot_factory):
    sender = query.from_user
    lang = language_of(sender)
    kind, _, rest = (query.data or '').partition(':')
    bot_id, _, rest = rest.partition(':')
    role, _, signature = rest.partition(':')
    async with db.public() as session:
        found = await active_setup(session, sender.id if sender else None)
        missing = await missing_roles(session, found[1].id) if found else []
    valid = (kind == 'retry' and bot_id.isdigit() and role in ROLES and found is not None
             and hmac.compare_digest(signature.encode(), retry_signature(bot_id, role, sender.id).encode()))
    if not valid:
        return await api.answer(bot, query.id, t(lang, 'unknown_bot'), alert=True)
    business = found[1]
    if role not in missing:  # already connected (pressed twice)
        await api.answer(bot, query.id)
        return await send_next_step(bot, db, sender.id, business, lang)
    try:
        connected = await attach(bot, db, bot_factory, business, int(bot_id), role, sender)
    except BotInUse:
        return await api.answer(bot, query.id, t(lang, 'in_use'), alert=True)
    except TelegramAPIError as exc:
        logger.warning('Retrying managed bot %s of %s: %s', bot_id, business.name, api.describe(exc))
        return await api.answer(bot, query.id, t(lang, 'still_failed'), alert=True)
    await api.answer(bot, query.id)
    if query.message:
        await api.clear_buttons(bot, sender.id, query.message.message_id)
    await finish(bot, db, business, connected, sender, lang)


def build_dispatcher():
    router = Router(name='platform')
    router.managed_bot.register(on_managed_bot)
    router.callback_query.register(on_callback)
    router.message.filter(F.chat.type == ChatType.PRIVATE, F.from_user)
    router.message.register(on_bot_created, F.managed_bot_created)
    router.message.register(on_setup, TextCommand('start', prefix='setup_'))
    router.message.register(on_message)

    dispatcher = Dispatcher(name='platform', disable_fsm=True)
    dispatcher.include_router(router)
    return dispatcher
