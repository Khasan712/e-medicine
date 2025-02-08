import asyncio
import logging
import sys
from os import getenv
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart
from aiogram.types import Message, CallbackQuery

from commons.products import get_product_detail_template, get_order_items_template, get_order_confirm_template
from keyboards.inline.language import get_quantity_keyboard, get_quantity_and_remove_keyboard, get_order_items_keyboard, \
    get_confirmation_emojis, get_confirmation_location, get_order_confirmation_phone, get_confirm_order_keyboard
from keyboards.markup.language import get_main_menu, language_markup, get_phone_markup, \
    get_products_keyboard, get_search_keyboard, get_location_markup, get_orders_keyboard, get_order_detail_keyboard
from commons.dictionary import DICTIONARY
from commons.constants import UZBEK_LANG, RUSSIAN_LANG, PHONE, LOCATION, ORDERED_ORDER_STATUS
from db.setup import init_db, get_db_session
from db.queries import get_client, create_client, fetch_or_create_client, get_product, get_product_by_id, \
    fetch_or_create_order, update_or_create_order_item, get_order_item, get_order_items, get_order, \
    mass_delete_order_items, get_orders, get_ordered_orders, get_order_items_by_order_id, get_order_by_id_exclude_new
from sqlalchemy.sql import func
from aiogram.fsm.context import FSMContext
from commons.states import UserState


load_dotenv()
TOKEN = getenv("BOT_TOKEN")

dp = Dispatcher()
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))


@dp.message(CommandStart())
async def command_start_handler(message: Message) -> None:
    client = await fetch_or_create_client(
        user_id=message.from_user.id,
        first_name=message.from_user.first_name,
        last_name=message.from_user.last_name,
        username=message.from_user.username
    )

    if not client.lang:
        await message.answer(
            text=f"{DICTIONARY['2'][UZBEK_LANG]}\n{DICTIONARY['2'][RUSSIAN_LANG]}",
            reply_markup=language_markup()
        )
    elif not client.tg_phone:
        await message.answer(text=DICTIONARY['11'][client.lang])
        await message.answer(text=DICTIONARY['4'][client.lang], reply_markup=get_phone_markup())
    else:
        await message.answer(text=DICTIONARY['11'][client.lang], reply_markup=get_main_menu(client.lang))


# user selects language
@dp.message(F.text.in_([DICTIONARY['1'][UZBEK_LANG], DICTIONARY['1'][RUSSIAN_LANG]]))
async def language_handler(message: Message) -> None:
    lang = UZBEK_LANG if message.text == DICTIONARY['1'][UZBEK_LANG] else RUSSIAN_LANG

    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        if client:
            client.lang = lang
            client.updated_at = func.now()
            await session.commit()
        else:
            await create_client(
                session=session,
                first_name=message.from_user.first_name,
                last_name=message.from_user.last_name,
                tg_id=str(message.from_user.id),
                tg_nick=message.from_user.username,
                lang=lang
            )

    await message.answer(text=DICTIONARY['4'][lang], reply_markup=get_phone_markup())


# asking phone number
@dp.message(F.contact)
async def phone_number_handler(message: Message) -> None:
    if message.contact.user_id != message.from_user.id:
        await message.answer("❌ You must send your own phone number!")
        return

    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        client.phone = message.contact.phone_number
        client.tg_phone = message.contact.phone_number
        client.updated_at = func.now()
        await session.commit()
        await message.answer(text=DICTIONARY['8'][client.lang], reply_markup=get_main_menu(client.lang))


# go back
@dp.message(F.text.in_([DICTIONARY['9'][UZBEK_LANG], DICTIONARY['9'][RUSSIAN_LANG]]))
async def handler_go_back(message: Message) -> None:
    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        await message.answer(text=DICTIONARY['8'][client.lang], reply_markup=get_main_menu(client.lang))


# Main menu handler
@dp.message(F.text.in_([DICTIONARY['8'][UZBEK_LANG], DICTIONARY['8'][RUSSIAN_LANG]]))
async def handler_main_menu(message: Message, state: FSMContext) -> None:
    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        await message.answer(text=DICTIONARY['8'][client.lang], reply_markup=get_main_menu(client.lang))
        await state.set_state(UserState.main_menu)


# My orders handler
@dp.message(F.text.in_([DICTIONARY['7'][UZBEK_LANG], DICTIONARY['7'][RUSSIAN_LANG]]))
async def handler_my_orders(message: Message, state: FSMContext) -> None:
    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        orders = await get_ordered_orders(session, client.id)
        if not orders:
            markup = await get_search_keyboard(client.lang)
            await message.answer(DICTIONARY['31'][client.lang], reply_markup=markup)
        else:
            markup = await get_orders_keyboard(orders, client.lang)
            await message.answer(text=DICTIONARY['7'][client.lang], reply_markup=markup)
            await state.set_state(UserState.my_orders_detail)


# My order detail handler
@dp.message(F.text.startswith('ID: '))
async def handler_my_orders(message: Message, state: FSMContext) -> None:
    order_id = None
    try:
        order_id = message.text.split()[1]
    except Exception as e:
        print(str(e))
    if not order_id:
        return
    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        order = await get_order_by_id_exclude_new(session, client.id, order_id)
        if not order:
            return
        order_items = await get_order_items_by_order_id(session, client.id, order_id)
        markup = await get_order_detail_keyboard(client.lang)
        if not order_items:
            await message.answer(text=DICTIONARY['35'][client.lang], reply_markup=markup)
        else:
            await message.answer(text=DICTIONARY['25'][client.lang], reply_markup=markup)



# Products list handler
@dp.message(F.text.in_([DICTIONARY['5'][UZBEK_LANG], DICTIONARY['5'][RUSSIAN_LANG]]))
async def products_handler(message: Message, state: FSMContext) -> None:
    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        markup = await get_products_keyboard(session, client.lang)
        await message.answer(text=DICTIONARY['10'][client.lang], reply_markup=markup)
        await state.set_state(UserState.products)


# Search button handler
@dp.message(F.text.in_([DICTIONARY['12'][UZBEK_LANG], DICTIONARY['12'][RUSSIAN_LANG]]))
async def handle_search_messages(message: Message, state: FSMContext):
    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        search_markup = await get_search_keyboard(client.lang)
        await message.answer(text=DICTIONARY['13'][client.lang], reply_markup=search_markup)
        await state.set_state(UserState.search)


# Cart page
@dp.message(F.text.in_([DICTIONARY['6'][UZBEK_LANG], DICTIONARY['6'][RUSSIAN_LANG]]))
async def handle_cart_page_messages(message: Message, state: FSMContext):
    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        order_items = await get_order_items(session, client.id)
        markup = await get_search_keyboard(client.lang)
        if not order_items:
            await message.answer(DICTIONARY['19'][client.lang], reply_markup=markup)
        else:
            await message.answer(DICTIONARY['6'][client.lang], reply_markup=markup)
            await message.answer(
                text=get_order_items_template(order_items, client.lang),
                reply_markup=get_order_items_keyboard(order_items, client.lang)
            )
    await state.set_state(UserState.cart)


# Product detail
@dp.message(F.text.startswith('💊 - '))
async def handle_product_detail(message: Message, state: FSMContext):
    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        product = await get_product(session, client.lang, message.text)
        if not product:
            return
        order_item = await get_order_item(session, product['id'], client.id)
        quantity = 1
        if order_item:
            quantity = int(order_item.quantity)
            await state.update_data({f"quantity_{product['id']}": quantity})
        await message.answer(
            text=get_product_detail_template(product['name'], product['desc'], product['price'], quantity, client.lang),
            reply_markup=get_quantity_keyboard(product['id'], quantity, client.lang)
        )


# update phone or location
@dp.callback_query(F.data.startswith('edit_order_'))
async def handle_location_or_phone(callback_query: CallbackQuery, state: FSMContext):
    action = callback_query.data.split('_')[-1]  # ✅ Use `callback_query.data` instead of `F.data`
    print("Action detected:", action)

    if action == PHONE:
        async for session in get_db_session():
            client = await get_client(session, callback_query.from_user.id)
        await callback_query.message.edit_text(
            text=DICTIONARY['28'][client.lang], reply_markup=None
        )
        await state.set_state(UserState.order_update_phone)
    elif action == LOCATION:
        async for session in get_db_session():
            client = await get_client(session, callback_query.from_user.id)
        await callback_query.message.edit_text(
            text=DICTIONARY['29'][client.lang], reply_markup=None
        )
        await state.set_state(UserState.order_update_location)


# confirmation ordering
@dp.callback_query(F.data == "ordering_products")
async def handler_confirmation_ordering_cart(callback_query: CallbackQuery, state: FSMContext):
    async for session in get_db_session():
        client = await get_client(session, callback_query.from_user.id)
        order_items = await get_order_items(session, client.id)
        if not order_items:
            return
        await callback_query.message.edit_text(
            text=get_order_confirm_template(order_items, client),
            reply_markup=get_confirm_order_keyboard(client)
        )


# Confirm order -- update order status to ordered
@dp.callback_query(F.data == "confirm_order")
async def handler_confirm_order(callback_query: CallbackQuery, state: FSMContext):
    async for session in get_db_session():
        client = await get_client(session, callback_query.from_user.id)
        order = await get_order(session, client.id)
        if not order:
            return
        elif not order.phone:
            await callback_query.message.edit_text(
                text=DICTIONARY['28'][client.lang], reply_markup=None
            )
            await state.set_state(UserState.order_update_phone)
        elif not order.location:
            await callback_query.message.edit_text(
                text=DICTIONARY['29'][client.lang], reply_markup=None
            )
            await state.set_state(UserState.order_update_location)
        else:
            order.status = ORDERED_ORDER_STATUS
            order.updated_at = func.now()
            await session.commit()
            await callback_query.message.edit_text(
                text=DICTIONARY['30'][client.lang], reply_markup=None
            )
            await callback_query.message.answer(
                text=DICTIONARY['8'][client.lang], reply_markup=get_main_menu(client.lang)
            )
            await state.set_state(UserState.main_menu)


# confirmation cleaning cart
@dp.callback_query(F.data == "cleaning_cart")
async def handler_confirmation_cleaning_cart(callback_query: CallbackQuery):
    async for session in get_db_session():
        client = await get_client(session, callback_query.from_user.id)
        order_items = await get_order_items(session, client.id)
        if not order_items:
            await callback_query.message.edit_text(text=DICTIONARY['19'][client.lang], reply_markup=None)
        else:
            text = f"{DICTIONARY['18'][client.lang]}! {DICTIONARY['20'][client.lang]}"
            await callback_query.message.edit_text(
                text=text, reply_markup=get_confirmation_emojis()
            )


# reject cleaning cart
@dp.callback_query(F.data == "reject_cleaning_cart")
async def handler_reject_cleaning_cart(callback_query: CallbackQuery):
    async for session in get_db_session():
        client = await get_client(session, callback_query.from_user.id)
        order_items = await get_order_items(session, client.id)
        if not order_items:
            await callback_query.message.edit_text(text=DICTIONARY['19'][client.lang], reply_markup=None)
        else:
            await callback_query.message.edit_text(
                text=get_order_items_template(order_items, client.lang),
                reply_markup=get_order_items_keyboard(order_items, client.lang),
                parse_mode="HTML"
            )


# confirm cleaning cart
@dp.callback_query(F.data == "confirm_cleaning_cart")
async def handler_confirmed_cleaning_cart(callback_query: CallbackQuery):
    async for session in get_db_session():
        client = await get_client(session, callback_query.from_user.id)
        order_items = await get_order_items(session, client.id)
        if not order_items:
            await callback_query.message.edit_text(text=DICTIONARY['19'][client.lang], reply_markup=None)
        else:
            order = await get_order(session, client.id)
            await mass_delete_order_items(session, order.id)
            await session.delete(order)
            await session.commit()
            await callback_query.message.edit_text(
                text=DICTIONARY['21'][client.lang],
                reply_markup=None
            )


# increase or decrease product quantity on cart page
@dp.callback_query(F.data.startswith("order_item_decrease_") | F.data.startswith("order_item_increase_"))
async def change_quantity_handler(callback_query: CallbackQuery):
    product_id = int(callback_query.data.split("_")[-1])
    # Fetch product data from the database or cache
    async for session in get_db_session():
        client = await get_client(session, callback_query.from_user.id)
        product = await get_product_by_id(session, product_id, client.lang)
        if not product:
            return
        order_item = await get_order_item(session, product['id'], client.id)
        if not order_item:
            return
        # Increase or decrease quantity
        if callback_query.data.startswith("order_item_increase_"):
            order_item.quantity = str(int(order_item.quantity) + 1)
            await session.commit()
        elif callback_query.data.startswith("order_item_decrease_"):
            if int(order_item.quantity) > 1:
                order_item.quantity = str(int(order_item.quantity) - 1)
                await session.commit()
            else:
                await session.delete(order_item)  # ✅ Correct way to delete
                await session.commit()
        order_items = await get_order_items(session, client.id)

    # Update the message with the new quantity
    await callback_query.message.edit_text(
        text=get_order_items_template(order_items, client.lang),
        reply_markup=get_order_items_keyboard(order_items, client.lang),
        parse_mode="HTML"
    )


# increase or decrease product quantity on product detail
@dp.callback_query(F.data.startswith("increase_") | F.data.startswith("decrease_"))
async def change_quantity_handler(callback_query: CallbackQuery, state: FSMContext):
    product_id = int(callback_query.data.split("_")[1])
    product = None

    # Fetch product data from the database or cache
    async for session in get_db_session():
        client = await get_client(session, callback_query.from_user.id)
        product = await get_product_by_id(session, product_id, client.lang)

        if not product:
            await callback_query.answer(DICTIONARY['14'][client.lang], show_alert=True)
            return

        # Retrieve the current quantity from the state
        data = await state.get_data()
        quantity = data.get(f"quantity_{client.id}_{product_id}", 1)

    # Increase or decrease quantity
    if callback_query.data.startswith("increase_"):
        quantity += 1
    elif callback_query.data.startswith("decrease_") and quantity > 1:
        quantity -= 1

    # Save the new quantity in the state
    await state.update_data({f"quantity_{client.id}_{product_id}": quantity})

    # Update the message with the new quantity
    await callback_query.message.edit_text(
        text=get_product_detail_template(product['name'], product['desc'], product['price'], quantity, client.lang),
        reply_markup=get_quantity_keyboard(product_id, quantity, client.lang),
        parse_mode="HTML"
    )


# Add to cart
@dp.callback_query(F.data.startswith("add_to_cart_"))
async def add_to_cart_handler(callback_query: CallbackQuery, state: FSMContext):
    product_id = int(callback_query.data.split("_")[3])
    data = await state.get_data()

    # ✅ Fetch product details from database
    async for session in get_db_session():
        client = await get_client(session, callback_query.from_user.id)
        product = await get_product_by_id(session, product_id, client.lang)

        if not product:
            await callback_query.answer("❌ Mahsulot topilmadi.", show_alert=True)
            return

        order = await fetch_or_create_order(session, client)
        if not order:
            return
        quantity = data.get(f"quantity_{client.id}_{product_id}", 1)
        await update_or_create_order_item(session, order.id, quantity, product_id, product['price'])
        markup = await get_products_keyboard(session, client.lang)

    # ✅ Check if message exists before editing
    if callback_query.message:
        await callback_query.message.edit_text(
            text=DICTIONARY['15'][client.lang],
            reply_markup=None  # Remove keyboard
        )
    await callback_query.answer(text=DICTIONARY['10'][client.lang], reply_markup=markup)


# Update order phone
@dp.message(UserState.order_update_phone)
async def handle_search_product_messages(message: Message, state: FSMContext):
    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        order = await get_order(session, client.id)
        if not order:
            return
        client.phone = message.text
        order.phone = message.text
        await session.commit()

        order_items = await get_order_items(session, client.id)
        if not order_items:
            return
        await message.answer(
            text=get_order_confirm_template(order_items, client),
            reply_markup=get_confirm_order_keyboard(client)
        )
        await state.set_state(UserState.main_menu)


# Update order location
@dp.message(UserState.order_update_location)
async def handle_search_product_messages(message: Message, state: FSMContext):
    if message.location:
        latitude = str(message.location.latitude)
        longitude = str(message.location.longitude)
        location = f'{latitude} {longitude}'
        async for session in get_db_session():
            client = await get_client(session, message.from_user.id)
            order = await get_order(session, client.id)
            if not order:
                return
            client.l_t = latitude
            client.e_t = longitude
            client.location = location
            order.l_t = latitude
            order.e_t = longitude
            order.location = location
            await session.commit()
            order_items = await get_order_items(session, client.id)
        await message.answer(
            text=get_order_confirm_template(order_items, client),
            reply_markup=get_confirm_order_keyboard(client)
        )
        await state.set_state(UserState.main_menu)
    elif message.text:
        async for session in get_db_session():
            client = await get_client(session, message.from_user.id)
            order = await get_order(session, client.id)
            if not order:
                return
            client.location = message.text
            order.location = message.text
            await session.commit()
            order_items = await get_order_items(session, client.id)
        await message.answer(
            text=get_order_confirm_template(order_items, client),
            reply_markup=get_confirm_order_keyboard(client)
        )
        await state.set_state(UserState.main_menu)


# User search products
@dp.message(UserState.search)
async def handle_search_product_messages(message: Message, state: FSMContext):
    async for session in get_db_session():
        client = await get_client(session, message.from_user.id)
        markup = await get_products_keyboard(session, client.lang, message.text)
        await message.answer(text=DICTIONARY['10'][client.lang], reply_markup=markup)
        # await state.set_state(UserState.products)


async def main() -> None:
    await dp.start_polling(bot)
    await init_db()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)
    asyncio.run(main())
