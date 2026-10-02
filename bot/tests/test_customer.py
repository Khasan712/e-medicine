"""The customers' bot: welcome with the shop, website sign-in, language."""
from datetime import timedelta

from sqlalchemy import update

from app.db.models import Business, BusinessBot, Client, TelegramLoginToken
from app.utils import now
from .fakes import callback, message, user


async def test_start_welcomes_with_the_shop(customer_bot, telegram, shop):
    await customer_bot.send(message(6001, '/start'))
    reply = telegram.last('sendMessage', 6001)
    assert reply['text'].startswith('👋 <b>Test Shop</b>ga xush kelibsiz!')
    assert reply['parse_mode'] == 'HTML'
    assert reply['reply_markup']['inline_keyboard'][0][0] == {
        'text': "🛍 Do'kon", 'web_app': {'url': 'https://test-shop.example.uz/'}}
    client = await shop.one(Client, Client.tg_id == '6001')
    assert (client.lang, client.first_name, client.tg_nick) == ('uz', 'Ali', 'ali')
    assert client.created_at is not None and client.updated_at is not None


async def test_russian_speakers_are_answered_in_russian(customer_bot, telegram, shop):
    await customer_bot.send(message(6005, '/start', language_code='ru'))
    reply = telegram.last('sendMessage', 6005)
    assert reply['text'].startswith('👋 Добро пожаловать в <b>Test Shop</b>!')
    assert reply['reply_markup']['inline_keyboard'][0][0]['text'] == '🛍 Магазин'
    assert (await shop.one(Client, Client.tg_id == '6005')).lang == 'ru'


async def test_known_customers_keep_their_profile(customer_bot, telegram, shop):
    await shop.add(Client(tg_id='6006', first_name='Shop name', lang=None, phone='+998901112233'))
    await customer_bot.send(message(6006, 'salom'))
    client = await shop.one(Client, Client.tg_id == '6006')
    assert (client.first_name, client.lang, client.phone) == ('Shop name', 'uz', '+998901112233')
    reply = telegram.last('sendMessage', 6006)
    assert reply['text'] == "🛍 Buyurtma berish uchun «Do'kon»ni oching."
    assert reply['reply_markup']['inline_keyboard'][0][0]['web_app']['url'] == 'https://test-shop.example.uz/'
    assert await shop.count(Client) == 1


async def test_website_sign_in_is_confirmed(customer_bot, telegram, shop):
    await shop.add(TelegramLoginToken(token='abc123', expires_at=now() + timedelta(minutes=5)))
    await customer_bot.send(message(6002, '/start login_abc123'))
    login = await shop.one(TelegramLoginToken)
    client = await shop.one(Client, Client.tg_id == '6002')
    assert (login.status, login.client_id) == ('confirmed', client.id)
    assert login.confirmed_at is not None
    assert telegram.last('sendMessage', 6002)['text'].startswith('✅')

    await customer_bot.send(message(6002, '/start login_abc123'))  # one use only
    assert telegram.last('sendMessage', 6002)['text'].startswith('⌛')


async def test_expired_sign_in_links_do_not_work(customer_bot, telegram, shop):
    await shop.add(TelegramLoginToken(token='old', expires_at=now() - timedelta(seconds=1)))
    await customer_bot.send(message(6007, '/start login_old', language_code='ru'))
    assert (await shop.one(TelegramLoginToken)).status == 'pending'
    assert telegram.last('sendMessage', 6007)['text'].startswith('⌛️ Ссылка устарела')


async def test_language(customer_bot, telegram, shop):
    await customer_bot.send(message(6003, '/lang'))
    assert telegram.buttons(telegram.last('sendMessage', 6003)) == ['lang:uz', 'lang:ru']
    await customer_bot.send(callback(6003, 'lang:ru', 101))
    assert (await shop.one(Client, Client.tg_id == '6003')).lang == 'ru'
    assert telegram.last('editMessageText', 6003) == {
        'chat_id': 6003, 'message_id': 101, 'text': '✅ Язык: русский', 'parse_mode': 'HTML',
        'link_preview_options': {'is_disabled': True}, 'reply_markup': {'inline_keyboard': []}}
    assert telegram.last('answerCallbackQuery')['callback_query_id'] == 'cb-101'


async def test_group_chats_are_ignored(customer_bot, telegram, shop):
    await customer_bot.send(message(-100, '/start', chat_type='group', sender=user(6008)))
    assert telegram.calls == []
    assert await shop.count(Client) == 0


async def test_switched_off_bots_and_suspended_businesses_are_silent(db, customer_bot, telegram, shop):
    async with db.public() as session:
        await session.execute(update(BusinessBot).where(BusinessBot.id == customer_bot.row.id).values(is_active=False))
        await session.commit()
    await customer_bot.send(message(6009, '/start'))
    async with db.public() as session:
        await session.execute(update(BusinessBot).values(is_active=True))
        await session.execute(update(Business).values(status='suspended'))
        await session.commit()
    await customer_bot.send(message(6009, '/start'))
    assert telegram.calls == []
    assert await shop.count(Client) == 0
