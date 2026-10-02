"""The runtime: which bots run, polling, one chat at a time, back-off, heartbeat, the background loop."""
import asyncio

import pytest
from aiohttp import web
from sqlalchemy import select, update

from app.config import settings
from app.crypto import encrypt
from app.db.models import Business, BusinessBot, OrderCard, Outbox
from app.telegram.api import BotFactory
from app.telegram.runtime import Poller, Runtime, Target
from .conftest import CUSTOMER_TOKEN, STAFF_TOKEN, add_bot, wait_until
from .fakes import ApiFailure, NetworkFailure, raw_message

PLATFORM_TOKEN = '1000:PLATFORM-TOKEN-00000000000000000000'


@pytest.fixture
async def runtime(db, telegram):
    runtime = Runtime(db, telegram.factory)
    yield runtime
    await runtime.shutdown(timeout=2)


async def set_bot(db, bot_id, **values):
    async with db.public() as session:
        await session.execute(update(BusinessBot).where(BusinessBot.id == bot_id).values(**values))
        await session.commit()


async def test_active_bots_of_active_businesses_are_polled(runtime, db, shop, other_shop, test_settings):
    client_bot = await add_bot(db, shop, 'client', CUSTOMER_TOKEN, 'a_bot', 2003)
    admin_bot = await add_bot(db, shop, 'admin', STAFF_TOKEN, 'a_admin_bot', 2002)
    await add_bot(db, other_shop, 'client', '3003:OTHER-TOKEN-0000000000000000000000', 'b_bot', 3003,
                  is_active=False)
    test_settings.platform_bot_token = PLATFORM_TOKEN
    desired = await runtime.desired_bots()
    assert set(desired) == {'platform', f'bot{client_bot.id}', f'bot{admin_bot.id}'}
    assert (desired[f'bot{client_bot.id}'].token, desired[f'bot{client_bot.id}'].role) == (CUSTOMER_TOKEN, 'client')
    assert desired[f'bot{admin_bot.id}'].business.schema_name == 'test_shop'

    test_settings.platform_bot_token = ''
    await set_bot(db, admin_bot.id, is_active=False)
    assert set(await runtime.desired_bots()) == {f'bot{client_bot.id}'}
    async with db.public() as session:
        await session.execute(update(Business).where(Business.id == shop.info.id).values(status='suspended'))
        await session.commit()
    assert await runtime.desired_bots() == {}


async def test_tokens_that_cannot_be_decrypted_are_skipped(runtime, db, shop, test_settings):
    bot = await add_bot(db, shop, 'client', CUSTOMER_TOKEN, 'a_bot', 2003)
    test_settings.secret_key = 'another-secret-key'
    assert await runtime.desired_bots() == {}
    test_settings.secret_key = 'test-secret-key-for-the-bot-service'
    assert set(await runtime.desired_bots()) == {f'bot{bot.id}'}


async def test_a_malformed_token_does_not_stop_the_other_bots(runtime, db, shop, telegram, test_settings):
    bot = await add_bot(db, shop, 'client', CUSTOMER_TOKEN, 'a_bot', 2003)
    test_settings.platform_bot_token = 'not a token'
    await runtime.reconcile()
    assert set(runtime.pollers) == {f'bot{bot.id}'}


async def test_reconcile_configures_starts_stops_and_restarts_bots(runtime, db, shop, telegram):
    client_bot = await add_bot(db, shop, 'client', CUSTOMER_TOKEN, 'testshop_bot', 2003)
    staff_bot = await add_bot(db, shop, 'admin', STAFF_TOKEN, 'testshop_admin_bot', 2002)
    await runtime.reconcile()
    assert set(runtime.pollers) == {f'bot{client_bot.id}', f'bot{staff_bot.id}'}
    await wait_until(lambda: 'getUpdates' in telegram.methods(CUSTOMER_TOKEN)
                     and 'getUpdates' in telegram.methods(STAFF_TOKEN))

    # Customers' bot: commands, descriptions (uz default, ru) and the shop as the Mini App.
    assert telegram.methods(CUSTOMER_TOKEN)[:8] == [
        'setMyCommands', 'setMyDescription', 'setMyShortDescription',
        'setMyCommands', 'setMyDescription', 'setMyShortDescription', 'setChatMenuButton', 'deleteWebhook']
    uz_commands, ru_commands = telegram.payloads('setMyCommands', token=CUSTOMER_TOKEN)
    assert uz_commands == {'commands': [{'command': 'start', 'description': 'Boshlash'},
                                        {'command': 'lang', 'description': 'Til / Язык'}]}
    assert ru_commands['language_code'] == 'ru'
    assert telegram.payloads('setMyShortDescription', token=CUSTOMER_TOKEN)[0]['short_description'] == \
        'Test Shop — onlayn buyurtma'
    assert telegram.last('setChatMenuButton', token=CUSTOMER_TOKEN)['menu_button'] == {
        'type': 'web_app', 'text': "🛍 Do'kon", 'web_app': {'url': 'https://test-shop.example.uz/'}}
    # Staff bot: its commands and the admin panel's Mini App sign-in route.
    assert [command['command'] for command in telegram.payloads('setMyCommands', token=STAFF_TOKEN)[0]['commands']] \
        == ['start', 'today', 'stats', 'lang']
    assert telegram.last('setChatMenuButton', token=STAFF_TOKEN)['menu_button'] == {
        'type': 'web_app', 'text': '📊 Panel', 'web_app': {'url': 'https://test-shop-admin.example.uz/tg'}}
    updates = telegram.last('getUpdates', token=CUSTOMER_TOKEN)
    assert (updates['allowed_updates'], updates['timeout']) == (['message', 'callback_query'], 50)

    # Switched off in the panel: stopped.
    old_poller = runtime.pollers[f'bot{client_bot.id}']
    await set_bot(db, client_bot.id, is_active=False)
    await runtime.reconcile()
    assert set(runtime.pollers) == {f'bot{staff_bot.id}'}
    assert old_poller.task.done()

    # A new token: restarted with it (and configured again).
    new_token = '2002:NEW-STAFF-TOKEN-00000000000000000'
    await set_bot(db, staff_bot.id, token_encrypted=encrypt(new_token))
    previous = runtime.pollers[f'bot{staff_bot.id}']
    await runtime.reconcile()
    assert runtime.pollers[f'bot{staff_bot.id}'].bot.token == new_token
    assert previous.task.done()
    await wait_until(lambda: 'getUpdates' in telegram.methods(new_token))
    assert 'setChatMenuButton' in telegram.methods(new_token)


async def test_poll_hands_updates_over_and_moves_the_offset(runtime, telegram):
    seen = []

    async def handle(poller, update):
        seen.append(update.update_id)

    runtime.handle = handle
    poller = Poller(runtime, Target('bot1', CUSTOMER_TOKEN, 'client', 1), telegram.bot(CUSTOMER_TOKEN))
    telegram.updates[CUSTOMER_TOKEN] = [raw_message(41, 10, 'a'), raw_message(42, 11, 'b')]
    await poller.poll_once(timeout=0)
    await asyncio.gather(*runtime.tasks)
    assert (seen, poller.offset, poller.healthy) == ([41, 42], 43, True)
    assert 'offset' not in telegram.payloads('getUpdates')[0]

    await poller.poll_once(timeout=0)
    assert telegram.last('getUpdates')['offset'] == 43
    assert seen == [41, 42]  # Telegram forgot the taken updates


async def test_one_chat_at_a_time_and_in_order(runtime, telegram):
    events, gate = [], asyncio.Event()

    async def handle(poller, update):
        events.append(('start', update.update_id))
        if update.update_id == 1:
            await gate.wait()
        events.append(('end', update.update_id))

    runtime.handle = handle
    poller = Poller(runtime, Target('bot1', CUSTOMER_TOKEN, 'client', 1), telegram.bot(CUSTOMER_TOKEN))
    telegram.updates[CUSTOMER_TOKEN] = [raw_message(1, 10, 'a'), raw_message(2, 10, 'b'), raw_message(3, 20, 'c')]
    await poller.poll_once(timeout=0)
    await wait_until(lambda: ('end', 3) in events)  # another chat is not held up
    assert ('start', 2) not in events  # the same chat waits for its previous update
    gate.set()
    await asyncio.gather(*runtime.tasks)
    assert events.index(('end', 1)) < events.index(('start', 2))
    assert len(runtime.locks) == 0


async def test_a_failing_update_does_not_stop_the_others(runtime, telegram, caplog):
    async def handle(poller, update):
        if update.update_id == 1:
            raise RuntimeError('boom')

    runtime.handle = handle
    poller = Poller(runtime, Target('bot1', CUSTOMER_TOKEN, 'client', 1), telegram.bot(CUSTOMER_TOKEN))
    telegram.updates[CUSTOMER_TOKEN] = [raw_message(1, 10, 'a'), raw_message(2, 10, 'b')]
    await poller.poll_once(timeout=0)
    await asyncio.gather(*runtime.tasks)
    assert 'bot1: update 1 failed' in caplog.text


@pytest.mark.parametrize('failure, pause', [
    (ApiFailure(409, 'Conflict: terminated by other getUpdates request'), 30),
    (ApiFailure(401, 'Unauthorized'), 30),
    (ApiFailure(404, 'Not Found'), 30),
    (ApiFailure(502, 'Bad Gateway'), 3),
    (NetworkFailure(), 3),
])
async def test_pollers_back_off(runtime, telegram, failure, pause):
    poller = Poller(runtime, Target('bot1', CUSTOMER_TOKEN, 'client', 1), telegram.bot(CUSTOMER_TOKEN))
    pauses = []

    async def record(seconds):
        pauses.append(seconds)

    poller.pause = record
    telegram.fail('getUpdates', failure)
    await poller.poll_once(timeout=0)
    assert (pauses, poller.healthy) == ([pause], False)


async def test_heartbeat_marks_the_bots_that_work(runtime, db, shop, telegram):
    working = await add_bot(db, shop, 'client', CUSTOMER_TOKEN, 'a_bot', 2003)
    broken = await add_bot(db, shop, 'admin', STAFF_TOKEN, 'a_admin_bot', 2002)
    for row, healthy in ((working, True), (broken, False)):
        poller = Poller(runtime, Target(f'bot{row.id}', 'x', row.role, row.id), None)
        poller.healthy = healthy
        runtime.pollers[poller.key] = poller
    await runtime.heartbeat()
    runtime.pollers.clear()
    async with db.public() as session:
        seen = dict((await session.execute(select(BusinessBot.id, BusinessBot.last_seen_at))).all())
    assert seen[working.id] is not None and seen[broken.id] is None


async def test_the_background_loop_notifies_staff_and_customers(runtime, db, shop, telegram):
    await add_bot(db, shop, 'client', CUSTOMER_TOKEN, 'a_bot', 2003)
    await add_bot(db, shop, 'admin', STAFF_TOKEN, 'a_admin_bot', 2002)
    await shop.link(5001, await shop.user('+998900000101', 'Xasan'))
    product = await shop.product('Kola', 'Кола', '12 000')
    order = await shop.order([(product, 1)], client=await shop.client(tg_id='777'))
    await shop.add(Outbox(kind='order_created', order_id=order.id))

    await runtime.reconcile()
    await runtime.notify()
    assert f'#{order.id}' in telegram.last('sendMessage', 5001, token=STAFF_TOKEN)['text']
    assert telegram.last('sendMessage', '777', token=CUSTOMER_TOKEN)['text'].startswith('✅ <b>Ваш заказ принят!</b>')
    assert await shop.count(OrderCard) == 1
    assert (await shop.one(Outbox)).sent_at is not None


async def test_run_serves_updates_and_stops_cleanly(db, shop, telegram, test_settings):
    await add_bot(db, shop, 'client', CUSTOMER_TOKEN, 'a_bot', 2003)
    test_settings.platform_bot_token = PLATFORM_TOKEN
    telegram.updates[CUSTOMER_TOKEN] = [raw_message(7, 6001, '/start')]
    telegram.updates[PLATFORM_TOKEN] = [raw_message(9, 8008, 'salom')]
    runtime = Runtime(db, telegram.factory)
    task = asyncio.create_task(runtime.run())
    await wait_until(lambda: telegram.last('sendMessage', 6001) and telegram.last('sendMessage', 8008))
    assert 'Test Shop' in telegram.last('sendMessage', 6001, token=CUSTOMER_TOKEN)['text']
    assert 'DeliveryHub' in telegram.last('sendMessage', 8008, token=PLATFORM_TOKEN)['text']
    assert telegram.last('getUpdates', token=PLATFORM_TOKEN)['allowed_updates'] == [
        'message', 'callback_query', 'managed_bot']

    runtime.request_stop()
    await asyncio.wait_for(task, timeout=5)
    assert runtime.pollers == {}
    # Telegram learnt which updates were taken.
    assert telegram.last('getUpdates', token=CUSTOMER_TOKEN)['offset'] == 8
    assert telegram.updates[CUSTOMER_TOKEN] == []
    async with db.public() as session:
        assert (await session.scalar(select(BusinessBot.last_seen_at))) is not None


async def test_updates_cut_short_by_a_shutdown_come_again(db, telegram):
    runtime = Runtime(db, telegram.factory)
    started = asyncio.Event()

    async def handle(poller, update):
        if update.update_id == 22:
            started.set()
            await asyncio.sleep(60)  # e.g. a voice order waiting for Gemini

    runtime.handle = handle
    poller = runtime.pollers['bot1'] = Poller(runtime, Target('bot1', CUSTOMER_TOKEN, 'client', 1),
                                              telegram.bot(CUSTOMER_TOKEN))
    telegram.updates[CUSTOMER_TOKEN] = [raw_message(21, 10, 'a'), raw_message(22, 11, 'b'), raw_message(23, 12, 'c')]
    await poller.poll_once(timeout=0)
    await started.wait()
    await runtime.shutdown(timeout=0.1)
    assert telegram.last('getUpdates')['offset'] == 22  # 22 (cut short) and the ones after it come again
    assert [update['update_id'] for update in telegram.updates[CUSTOMER_TOKEN]] == [22, 23]


async def test_the_real_http_session_talks_to_the_bot_api(db, shop, monkeypatch):
    """The production session (aiohttp, TELEGRAM_API_URL) against a local fake Bot API server."""
    received, queued = [], [raw_message(5, 6001, '/start')]

    async def bot_api(request):
        method, data = request.match_info['method'], dict(await request.post())
        received.append((request.match_info['token'], method, data))
        if method == 'getUpdates':
            result, queued[:] = list(queued), []
        elif method == 'sendMessage':
            result = {'message_id': 1, 'date': 1700000000, 'chat': {'id': int(data['chat_id']), 'type': 'private'}}
        else:
            result = True
        return web.json_response({'ok': True, 'result': result})

    server = web.Application()
    server.router.add_post('/bot{token}/{method}', bot_api)
    runner = web.AppRunner(server)
    await runner.setup()
    site = web.TCPSite(runner, '127.0.0.1', 0)
    await site.start()
    port = site._server.sockets[0].getsockname()[1]
    monkeypatch.setattr(settings, 'telegram_api_url', f'http://127.0.0.1:{port}')

    await add_bot(db, shop, 'client', CUSTOMER_TOKEN, 'a_bot', 2003)
    factory = BotFactory()
    runtime = Runtime(db, factory)
    try:
        await runtime.reconcile()
        await wait_until(lambda: any(method == 'sendMessage' for _, method, _ in received))
    finally:
        await runtime.shutdown(timeout=2)
        await factory.close()
        await runner.cleanup()
    token, _, sent = next(item for item in received if item[1] == 'sendMessage')
    assert token == CUSTOMER_TOKEN and sent['chat_id'] == '6001' and sent['parse_mode'] == 'HTML'
    assert '"url": "https://test-shop.example.uz/"' in sent['reply_markup']
