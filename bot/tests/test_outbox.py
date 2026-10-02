"""Customer messages from the outbox: texts, language, retries, giving up, order of messages."""
from dataclasses import replace
from types import SimpleNamespace

import pytest
from sqlalchemy import select, update

from app import outbox
from app.db.models import Outbox, StaffLink
from .conftest import ago
from .fakes import ApiFailure, NetworkFailure, callback


@pytest.fixture
async def menu(shop):
    unit = await shop.unit()
    return SimpleNamespace(
        burger=await shop.product('Chizburger', 'Чизбургер', '35 000', unit),
        cola=await shop.product('Kola', 'Кола', '12 000', unit),
    )


async def queue(shop, order, kind='order_status', event='', created_at=None):
    """What the backend writes (Outbox.objects.create(...): the database fills the defaults)."""
    row = Outbox(kind=kind, order_id=order.id, event=event)
    if created_at is not None:
        row.created_at = created_at
    return await shop.add(row)


async def send(customer_bot, shop):
    return await outbox.send_pending(customer_bot.db, shop.info, customer_bot.bot)


async def test_order_placed_message_in_the_customer_language(customer_bot, telegram, shop, menu):
    client = await shop.client(tg_id='777', lang='ru')
    order = await shop.order([(menu.burger, 2), (menu.cola, 1)], client=client)
    await queue(shop, order, kind='order_created')

    assert await send(customer_bot, shop) == 1
    message = telegram.last('sendMessage', '777')
    assert message['text'] == '\n'.join([
        '✅ <b>Ваш заказ принят!</b>', f'🧾 #{order.id}', '',
        '• Чизбургер × 2 = 70 000 сум', '• Кола × 1 = 12 000 сум', '',
        '💵 <b>Итого: 82 000 сум</b>', '', 'Скоро мы с вами свяжемся. Спасибо! 😊',
    ])
    assert message['parse_mode'] == 'HTML'
    assert telegram.calls[-1].token == customer_bot.bot.token  # from the customers' bot
    row = await shop.one(Outbox)
    assert row.sent_at is not None and (row.attempts, row.error) == (0, '')

    assert await send(customer_bot, shop) == 0  # once
    assert len(telegram.payloads('sendMessage')) == 1


async def test_status_messages(customer_bot, telegram, shop, menu):
    uzbek = await shop.client(tg_id='801', lang='uz')
    russian = await shop.client(tg_id='802', lang='ru')
    delivery = await shop.order([(menu.burger, 1)], client=uzbek)
    pickup = await shop.order([(menu.cola, 1)], client=russian, delivery_type='pickup')
    for order, event in ((delivery, 'accepted'), (delivery, 'on_the_way'), (delivery, 'completed'),
                         (pickup, 'completed'), (pickup, 'rejected')):
        await queue(shop, order, event=event)
    business = replace(shop.info, support_phone='+998 71 200 00 00')

    assert await outbox.send_pending(customer_bot.db, business, customer_bot.bot) == 5
    assert [payload['text'] for payload in telegram.payloads('sendMessage', '801')] == [
        f'👨‍🍳 Buyurtmangiz #{delivery.id} qabul qilindi va tayyorlanmoqda!',
        f'🚚 Buyurtmangiz #{delivery.id} yo‘lda! Tez orada yetkazamiz.',
        f'✅ Buyurtmangiz #{delivery.id} yetkazildi. Yoqimli ishtaha! 😋',
    ]
    assert [payload['text'] for payload in telegram.payloads('sendMessage', '802')] == [
        f'✅ Ваш заказ #{pickup.id} выдан. Приятного аппетита! 😋',
        f'😔 К сожалению, ваш заказ #{pickup.id} отменён. Если есть вопросы — свяжитесь с нами.\n☎️ +998 71 200 00 00',
    ]


async def test_failed_messages_are_retried_after_a_pause(customer_bot, telegram, shop, menu):
    order = await shop.order([(menu.burger, 1)], client=await shop.client())
    row = await queue(shop, order, event='accepted')
    telegram.fail('sendMessage', NetworkFailure(), times=1)

    assert await send(customer_bot, shop) == 0
    row = await shop.one(Outbox)
    assert (row.attempts, row.sent_at) == (1, None)
    assert 'Cannot connect' in row.error

    assert await send(customer_bot, shop) == 0  # the next attempt waits a little
    assert len(telegram.payloads('sendMessage')) == 1

    await shop.update(update(Outbox).values(created_at=ago(seconds=11)))
    assert await send(customer_bot, shop) == 1
    row = await shop.one(Outbox)
    assert row.sent_at is not None and row.attempts == 1


async def test_gives_up_after_five_attempts(customer_bot, telegram, shop, menu):
    order = await shop.order([(menu.burger, 1)], client=await shop.client())
    await queue(shop, order, event='on_the_way', created_at=ago(hours=1))
    telegram.fail('sendMessage', ApiFailure(502, 'Bad Gateway'))
    for attempt in range(1, 6):
        await send(customer_bot, shop)
        assert (await shop.one(Outbox)).attempts == attempt
    await send(customer_bot, shop)
    assert len(telegram.payloads('sendMessage')) == 5
    row = await shop.one(Outbox)
    assert (row.attempts, row.sent_at, row.error) == (5, None, 'Bad Gateway')


async def test_flood_control_waits_and_repeats(customer_bot, telegram, shop, menu):
    order = await shop.order([(menu.burger, 1)], client=await shop.client())
    await queue(shop, order, event='accepted')
    telegram.fail('sendMessage', ApiFailure(429, 'Too Many Requests: retry after 1', retry_after=1), times=1)
    assert await send(customer_bot, shop) == 1
    assert len(telegram.payloads('sendMessage')) == 2
    assert (await shop.one(Outbox)).attempts == 0


async def test_blocked_bots_and_unknown_chats_are_given_up_at_once(customer_bot, telegram, shop, menu):
    blocked = await shop.order([(menu.burger, 1)], client=await shop.client(tg_id='901'))
    unknown = await shop.order([(menu.burger, 1)], client=await shop.client(tg_id='902'))
    await queue(shop, blocked, event='accepted')
    await queue(shop, unknown, event='accepted')
    telegram.fail('sendMessage', ApiFailure(403, 'Forbidden: bot was blocked by the user'),
                  when=lambda call: call.payload['chat_id'] == '901')
    telegram.fail('sendMessage', ApiFailure(400, 'Bad Request: chat not found'))
    await send(customer_bot, shop)
    rows = await shop.all(Outbox)
    assert [(row.attempts, row.error) for row in rows] == [
        (5, 'Forbidden: bot was blocked by the user'), (5, 'Bad Request: chat not found')]
    await send(customer_bot, shop)
    assert len(telegram.payloads('sendMessage')) == 2


async def test_customers_without_telegram_and_stale_messages_are_skipped(customer_bot, telegram, shop, menu):
    web_customer = await shop.order([(menu.burger, 1)], client=await shop.client(tg_id=None))
    stale = await shop.order([(menu.burger, 1)], client=await shop.client(tg_id='903'))
    await queue(shop, web_customer, kind='order_created')
    await queue(shop, stale, event='accepted', created_at=ago(hours=7))
    assert await send(customer_bot, shop) == 0
    assert telegram.payloads('sendMessage') == []
    assert [(row.attempts, row.error) for row in await shop.all(Outbox)] == [
        (5, 'the customer has no Telegram chat'), (5, 'expired')]


async def test_messages_about_one_order_keep_their_order(customer_bot, telegram, shop, menu):
    first = await shop.order([(menu.burger, 1)], client=await shop.client(tg_id='904'))
    second = await shop.order([(menu.cola, 1)], client=await shop.client(tg_id='905'))
    await queue(shop, first, kind='order_created')
    await queue(shop, first, event='accepted')
    await queue(shop, second, event='accepted')
    telegram.fail('sendMessage', NetworkFailure(), times=1, when=lambda call: 'принят!' in call.payload['text'])

    await send(customer_bot, shop)  # the first message failed: the second waits, the other order goes
    assert [payload['chat_id'] for payload in telegram.payloads('sendMessage')] == ['904', '905']
    await send(customer_bot, shop)
    assert len(telegram.payloads('sendMessage')) == 2

    await shop.update(update(Outbox).where(Outbox.attempts == 1).values(created_at=ago(seconds=11)))
    await send(customer_bot, shop)
    await send(customer_bot, shop)
    texts = [payload['text'] for payload in telegram.payloads('sendMessage', '904')]
    assert texts[1].startswith('✅ <b>Ваш заказ принят!</b>')
    assert texts[2] == f'👨‍🍳 Ваш заказ #{first.id} принят и уже готовится!'
    assert all(row.sent_at for row in await shop.all(Outbox))


async def test_a_row_taken_by_another_service_is_not_sent_twice(customer_bot, telegram, shop, menu):
    order = await shop.order([(menu.burger, 1)], client=await shop.client())
    row = await queue(shop, order, event='accepted')
    async with shop.session() as other:
        await other.execute(select(Outbox).where(Outbox.id == row.id).with_for_update())
        assert await send(customer_bot, shop) == 0
        await other.rollback()
    assert telegram.payloads('sendMessage') == []
    assert await send(customer_bot, shop) == 1


async def test_a_status_changed_in_the_staff_bot_reaches_the_customer(staff_bot, customer_bot, telegram, shop, menu):
    admin = await shop.user('+998900000101', 'Xasan')
    await shop.link(5001, admin, 'Xasan')
    order = await shop.order([(menu.burger, 2)], client=await shop.client(tg_id='906', lang='ru'))
    await staff_bot.send(callback(5001, f'order:{order.id}:accept', 50))
    assert await send(customer_bot, shop) == 1
    message = telegram.last('sendMessage', '906')
    assert message['text'] == f'👨‍🍳 Ваш заказ #{order.id} принят и уже готовится!'
    assert telegram.calls[-1].token == customer_bot.bot.token
    assert await shop.count(StaffLink) == 1
