"""The customers' bot of a business. Orders are placed in the shop (Mini App); the bot welcomes customers with
the shop button, confirms website sign-ins (t.me/<bot>?start=login_<token>) and lets them pick a language.
Messages about orders come from the outbox (app.outbox). Runs in the business's schema (`db`, `business`)."""
from html import escape

from aiogram import Bot, Dispatcher, F, Router
from aiogram.dispatcher.middlewares.base import BaseMiddleware
from aiogram.enums import ChatType
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from app.db.models import Client, TelegramLoginToken
from app.telegram import api
from app.telegram.filters import TextCommand
from app.utils import now
from .texts import LANGUAGES, language_of, t

LOGIN_PENDING = 'pending'
LOGIN_CONFIRMED = 'confirmed'


def shop_button(lang, business):
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=t(lang, 'btn_shop'), web_app=WebAppInfo(url=business.shop_url)),
    ]])


def language_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="🇺🇿 O'zbekcha", callback_data='lang:uz'),
        InlineKeyboardButton(text='🇷🇺 Русский', callback_data='lang:ru'),
    ]])


async def get_client(session, sender):
    """The customer behind a Telegram account, created on the first message (committed)."""
    lang = language_of(sender)
    stamp = now()
    # Two updates of a new customer may come at once: the second insert does nothing.
    await session.execute(insert(Client).values(
        tg_id=str(sender.id),
        first_name=(sender.first_name or '')[:100] or None,
        last_name=(sender.last_name or '')[:100] or None,
        tg_nick=(sender.username or '')[:100] or None,
        lang=lang,
        created_at=stamp,
        updated_at=stamp,
    ).on_conflict_do_nothing(index_elements=[Client.tg_id]))
    client = await session.scalar(select(Client).where(Client.tg_id == str(sender.id)))
    if client.lang not in LANGUAGES:
        client.lang = lang
        client.updated_at = stamp
    await session.commit()
    return client


async def confirm_login(session, token, client):
    """The website polls the token and signs the customer in once it is confirmed (backend shop API)."""
    stamp = now()
    result = await session.execute(
        update(TelegramLoginToken)
        .where(TelegramLoginToken.token == token, TelegramLoginToken.status == LOGIN_PENDING,
               TelegramLoginToken.expires_at > stamp)
        .values(client_id=client.id, status=LOGIN_CONFIRMED, confirmed_at=stamp)
        .execution_options(synchronize_session=False)
    )
    await session.commit()
    return bool(result.rowcount)


class ClientMiddleware(BaseMiddleware):
    """Every private message comes from a customer: passes `client` to the handler."""

    async def __call__(self, handler, event, data):
        db, business = data['db'], data['business']
        async with db.tenant(business.schema_name) as session:
            data['client'] = await get_client(session, event.from_user)
        return await handler(event, data)


async def on_login(message: Message, bot: Bot, db, business, client, argument: str):
    async with db.tenant(business.schema_name) as session:
        confirmed = await confirm_login(session, argument[6:], client)
    await api.send(bot, message.chat.id, t(client.lang, 'login_ok' if confirmed else 'login_invalid'))


async def on_language_command(message: Message, bot: Bot, client):
    await api.send(bot, message.chat.id, t(client.lang, 'lang_choose'), language_keyboard())


async def on_start(message: Message, bot: Bot, business, client):
    await api.send(bot, message.chat.id, t(client.lang, 'welcome', name=escape(business.name)),
                   shop_button(client.lang, business))


async def on_other(message: Message, bot: Bot, business, client):
    await api.send(bot, message.chat.id, t(client.lang, 'hint'), shop_button(client.lang, business))


async def on_callback(query: CallbackQuery, bot: Bot, db, business):
    sender = query.from_user
    kind, _, value = (query.data or '').partition(':')
    if kind == 'lang' and value in LANGUAGES and sender and sender.id:
        async with db.tenant(business.schema_name) as session:
            await session.execute(
                update(Client).where(Client.tg_id == str(sender.id)).values(lang=value, updated_at=now())
                .execution_options(synchronize_session=False)
            )
            await session.commit()
        if query.message:
            await api.edit(bot, sender.id, query.message.message_id, t(value, 'lang_saved'))
    await api.answer(bot, query.id)


def build_dispatcher():
    router = Router(name='customer')
    router.message.filter(F.chat.type == ChatType.PRIVATE, F.from_user)
    router.message.middleware(ClientMiddleware())
    router.message.register(on_login, TextCommand('start', prefix='login_'))
    router.message.register(on_language_command, TextCommand('lang', 'til'))
    router.message.register(on_start, TextCommand('start'))
    router.message.register(on_other)
    router.callback_query.register(on_callback)

    dispatcher = Dispatcher(name='customer', disable_fsm=True)
    dispatcher.include_router(router)
    return dispatcher
