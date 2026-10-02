"""Our platform bot: setup link → two managed bots → tokens stored encrypted → the owner linked to the staff bot."""
import base64
import hashlib
import secrets
from datetime import timedelta

import pytest
from cryptography.fernet import Fernet
from sqlalchemy import select, update

from app.db.models import BotSetup, BusinessBot, StaffLink
from app.platform import handlers as platform
from app.utils import now
from .conftest import SECRET_KEY, PlatformDriver, add_bot
from .fakes import ApiFailure, NetworkFailure, callback, managed, message

PLATFORM_TOKEN = '1000:PLATFORM-TOKEN-00000000000000000000'
CLIENT_TOKEN = '4001:CLIENT-TOKEN-0000000000000000000000'
ADMIN_TOKEN = '4002:ADMIN-TOKEN-00000000000000000000000'
OWNER = 8008


def backend_decrypt(value):
    """apps.platform.crypto.decrypt of the backend, with the same SECRET_KEY."""
    digest = hashlib.sha256(f'hub.bot-tokens:{SECRET_KEY}'.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest)).decrypt(value.encode()).decode()


@pytest.fixture
def platform_bot(db, telegram, handlers, test_settings):
    test_settings.platform_bot_token = PLATFORM_TOKEN
    telegram.me[PLATFORM_TOKEN] = {'id': 1000, 'is_bot': True, 'first_name': 'DeliveryHub', 'username': 'platform_bot'}
    telegram.me[CLIENT_TOKEN] = {'id': 4001, 'is_bot': True, 'first_name': 'Test Shop', 'username': 'testshop_bot'}
    telegram.me[ADMIN_TOKEN] = {'id': 4002, 'is_bot': True, 'first_name': 'Test Shop Admin',
                                'username': 'testshop_admin_bot'}
    telegram.managed_tokens.update({4001: CLIENT_TOKEN, 4002: ADMIN_TOKEN})
    return PlatformDriver(handlers, db, telegram, PLATFORM_TOKEN)


@pytest.fixture
def no_waiting(monkeypatch):
    pauses = []

    async def sleep(seconds):
        pauses.append(seconds)

    monkeypatch.setattr(platform, 'sleep', sleep)
    return pauses


async def setup_link(db, shop, expires_in=timedelta(days=7)):
    """What our panel does: a link with a one-time token, only its hash stored."""
    token = secrets.token_urlsafe(18)
    async with db.public() as session:
        session.add(BotSetup(business_id=shop.info.id, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                             expires_at=now() + expires_in))
        await session.commit()
    return f'https://t.me/platform_bot?start=setup_{token}'


async def start_setup(platform_bot, db, shop):
    link = await setup_link(db, shop)
    await platform_bot.send(message(OWNER, '/start ' + link.split('start=')[1], sender=owner()))


def owner(language_code='uz'):
    return {'id': OWNER, 'is_bot': False, 'first_name': 'Aziz', 'username': 'aziz', 'language_code': language_code}


async def bots(db, **where):
    async with db.public() as session:
        statement = select(BusinessBot).filter_by(**where).order_by(BusinessBot.id)
        return list((await session.scalars(statement)).all())


def requested_username(payload):
    return payload['reply_markup']['keyboard'][0][0]['request_managed_bot']['suggested_username']


async def test_two_taps_create_both_bots(platform_bot, telegram, db, shop):
    first_admin = await shop.user('+998900000700', 'Aziz')
    await shop.user('+998900000701', 'Later admin')
    await start_setup(platform_bot, db, shop)
    start, step = telegram.payloads('sendMessage', OWNER)
    assert start['text'].startswith('🚀 <b>Test Shop</b> uchun Telegram botlarini yaratamiz.')
    assert step['reply_markup']['keyboard'][0][0] == {
        'text': '🛍 Mijozlar botini yaratish',
        'request_managed_bot': {'request_id': 1, 'suggested_name': 'Test Shop', 'suggested_username': 'test_shop_bot'},
    }
    assert step['reply_markup']['one_time_keyboard'] is True
    assert 'https://t.me/newbot/platform_bot/test_shop_bot?name=Test%20Shop' in step['text']
    async with db.public() as session:
        assert (await session.scalar(select(BotSetup))).telegram_user_id == OWNER

    await platform_bot.send(managed(OWNER, 4001, 'testshop_bot'))
    [client_bot] = await bots(db)
    assert (client_bot.business_id, client_bot.role, client_bot.telegram_id, client_bot.username, client_bot.name,
            client_bot.created_via, client_bot.owner_telegram_id, client_bot.is_active) == (
        shop.info.id, 'client', 4001, 'testshop_bot', 'Test Shop', 'managed', OWNER, True)
    assert CLIENT_TOKEN not in client_bot.token_encrypted
    assert backend_decrypt(client_bot.token_encrypted) == CLIENT_TOKEN  # the backend reads it
    connected, step = telegram.payloads('sendMessage', OWNER)[-2:]
    assert connected['text'] == '✅ @testshop_bot ulandi va sozlandi.'
    assert requested_username(step) == 'test_shop_admin_bot'
    assert step['reply_markup']['keyboard'][0][0]['request_managed_bot']['suggested_name'] == 'Test Shop Admin'

    await platform_bot.send(managed(OWNER, 4002, 'testshop_admin_bot'))
    [admin_bot] = await bots(db, role='admin')
    assert backend_decrypt(admin_bot.token_encrypted) == ADMIN_TOKEN
    link = await shop.one(StaffLink)
    assert (link.telegram_id, link.user_id, link.first_name, link.username, link.lang, link.notify_orders) == (
        OWNER, first_admin.id, 'Aziz', 'aziz', 'uz', True)
    done = telegram.last('sendMessage', OWNER)
    assert '@testshop_bot' in done['text'] and '@testshop_admin_bot' in done['text']
    assert 'https://test-shop.example.uz/' in done['text'] and 'https://test-shop-admin.example.uz/' in done['text']
    assert done['reply_markup'] == {'remove_keyboard': True}


async def test_the_staff_bot_may_come_first(platform_bot, telegram, db, shop):
    await start_setup(platform_bot, db, shop)
    await platform_bot.send(managed(OWNER, 4002, 'testshop_admin_bot'))  # "admin" in the name
    assert [bot.role for bot in await bots(db)] == ['admin']
    assert requested_username(telegram.last('sendMessage', OWNER)) == 'test_shop_bot'


async def test_a_lost_connection_offers_a_retry_button(platform_bot, telegram, db, shop, no_waiting):
    await start_setup(platform_bot, db, shop)
    telegram.fail('getManagedBotToken', NetworkFailure('SSLError: EOF occurred in violation of protocol'))
    await platform_bot.send(managed(OWNER, 4001, 'testshop_bot'))
    assert len(telegram.payloads('getManagedBotToken')) == 3 and no_waiting == [2, 4]
    offer = telegram.last('sendMessage', OWNER)
    assert 'Qayta ulash' in offer['text']
    assert await bots(db) == []

    telegram.heal()  # the network is back
    retry = offer['reply_markup']['inline_keyboard'][0][0]
    assert retry['text'] == '🔄 Qayta ulash'
    await platform_bot.send(callback(OWNER, retry['callback_data'], 999))
    assert [(bot.role, bot.username) for bot in await bots(db)] == [('client', 'testshop_bot')]
    assert telegram.last('editMessageReplyMarkup')['message_id'] == 999
    assert requested_username(telegram.last('sendMessage', OWNER)) == 'test_shop_admin_bot'  # on to the staff bot

    await platform_bot.send(callback(OWNER, retry['callback_data'], 999))  # pressed twice
    assert len(await bots(db)) == 1
    assert requested_username(telegram.last('sendMessage', OWNER)) == 'test_shop_admin_bot'


async def test_an_answer_of_the_bot_api_is_not_retried(platform_bot, telegram, db, shop, no_waiting):
    await start_setup(platform_bot, db, shop)
    telegram.fail('getManagedBotToken', ApiFailure(400, 'Bad Request: bot not found'))
    await platform_bot.send(managed(OWNER, 4001, 'testshop_bot'))
    assert len(telegram.payloads('getManagedBotToken')) == 1 and no_waiting == []
    assert 'Qayta ulash' in telegram.last('sendMessage', OWNER)['text']

    retry = telegram.last('sendMessage', OWNER)['reply_markup']['inline_keyboard'][0][0]['callback_data']
    await platform_bot.send(callback(OWNER, retry, 999))  # still failing
    assert telegram.last('answerCallbackQuery') == {
        'callback_query_id': 'cb-999', 'text': "Hali ulanmadi — birozdan so'ng yana bosing", 'show_alert': True}


async def test_retry_buttons_cannot_be_forged(platform_bot, telegram, db, shop):
    await start_setup(platform_bot, db, shop)
    for data in ('retry:4001:client:000000000000', platform.retry_data(4001, 'client', 9999),
                 platform.retry_data(4001, 'owner', OWNER), 'retry:x:client:abc', 'retry', 'something'):
        await platform_bot.send(callback(OWNER, data, 999))
        answer = telegram.last('answerCallbackQuery')
        assert answer['show_alert'] is True and 'havolani' in answer['text']
    # A real signature does not help someone who has not opened a setup link.
    await platform_bot.send(callback(9999, platform.retry_data(4001, 'client', 9999), 999))
    assert telegram.last('answerCallbackQuery')['show_alert'] is True
    assert await bots(db) == []
    assert telegram.payloads('getManagedBotToken') == []


async def test_bots_from_strangers_are_not_attached(platform_bot, telegram, db, shop):
    await platform_bot.send(managed(OWNER, 4001, 'random_bot'))
    assert await bots(db) == []
    assert 'havolani' in telegram.last('sendMessage', OWNER)['text']


async def test_expired_setup_links_do_not_work(platform_bot, telegram, db, shop):
    link = await setup_link(db, shop)
    async with db.public() as session:
        await session.execute(update(BotSetup).values(expires_at=now() - timedelta(minutes=1)))
        await session.commit()
    await platform_bot.send(message(OWNER, '/start ' + link.split('start=')[1]))
    assert 'eskirgan' in telegram.last('sendMessage', OWNER)['text']
    await platform_bot.send(managed(OWNER, 4001, 'testshop_bot'))
    assert await bots(db) == []


async def test_a_new_token_of_a_known_bot_is_stored(platform_bot, telegram, db, shop):
    old = await add_bot(db, shop, 'client', CLIENT_TOKEN, 'testshop_bot', 4001)
    telegram.managed_tokens[4001] = '4001:NEW-TOKEN-AFTER-REVOKE-000000000000'
    await platform_bot.send(managed(7007, 4001, 'testshop_bot'))
    [bot] = await bots(db)
    assert bot.id == old.id
    assert backend_decrypt(bot.token_encrypted) == '4001:NEW-TOKEN-AFTER-REVOKE-000000000000'
    assert bot.owner_telegram_id == 7007
    assert telegram.payloads('sendMessage') == []


async def test_other_messages(platform_bot, telegram, db, shop):
    await platform_bot.send(message(OWNER, 'salom', language_code='ru'))
    assert telegram.last('sendMessage', OWNER)['text'].startswith('👋 Это бот платформы DeliveryHub.')
    calls = len(telegram.calls)
    await platform_bot.send(message(OWNER, managed_bot_created={
        'bot': {'id': 4001, 'is_bot': True, 'first_name': 'x', 'username': 'testshop_bot'}}))
    assert len(telegram.calls) == calls  # the bot itself arrives as a managed_bot update
