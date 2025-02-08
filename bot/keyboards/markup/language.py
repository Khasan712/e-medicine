from aiogram.types import KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove
from commons.constants import UZBEK_LANG, RUSSIAN_LANG
from commons.dictionary import DICTIONARY
from db.queries import get_products
import pytz

TASHKENT_TZ = pytz.timezone("Asia/Tashkent")


def language_markup():
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text=DICTIONARY['1'][UZBEK_LANG]),
                KeyboardButton(text=DICTIONARY['1'][RUSSIAN_LANG])
            ]
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )


def get_phone_markup():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📞 Share phone number", request_contact=True)]
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )


def get_main_menu(lang):
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text=DICTIONARY['5'][lang]),
                KeyboardButton(text=DICTIONARY['6'][lang]),
            ],
            [
                KeyboardButton(text=DICTIONARY['7'][lang]),
            ]
        ],
        resize_keyboard=True,
    )


async def get_products_keyboard(session, lang, name=None):
    products = await get_products(session, lang, name)

    # Generate product buttons (each product on a new row)
    products_keyboard = [[KeyboardButton(text=f'💊 - {product[1]} / {product[2]}')] for product in products]

    if name:
        keyboard = [
            [KeyboardButton(text=DICTIONARY['9'][lang])]
        ] + products_keyboard
    else:
        keyboard = [
             [
                 KeyboardButton(text=DICTIONARY['9'][lang]),
                 KeyboardButton(text=DICTIONARY['12'][lang])
             ]
        ] + products_keyboard
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)


async def get_search_keyboard(lang):
    return ReplyKeyboardMarkup(keyboard=[
        [
            KeyboardButton(text=DICTIONARY['5'][lang]),
            KeyboardButton(text=DICTIONARY['8'][lang]),
        ]
    ], resize_keyboard=True)


async def get_order_detail_keyboard(lang):
    return ReplyKeyboardMarkup(keyboard=[
        [
            KeyboardButton(text=DICTIONARY['7'][lang]),
            KeyboardButton(text=DICTIONARY['8'][lang]),
        ]
    ], resize_keyboard=True)


async def get_location_markup(lang):
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text=DICTIONARY['6'][lang]),
                KeyboardButton(text=DICTIONARY['8'][lang]),
            ],
        ],
        resize_keyboard=True,
        one_time_keyboard=True
    )


async def get_orders_keyboard(orders, lang):
    products_main_page = await get_search_keyboard(lang)
    for order in orders:
        status = DICTIONARY['34'][lang][order.status]
        updated_time = order.updated_at.astimezone(TASHKENT_TZ).strftime("%Y-%m-%d %H:%M") if order.updated_at else "N/A"
        button_text = f"ID: {order.id} | {DICTIONARY['32'][lang]}: {updated_time}\n{DICTIONARY['33'][lang]}: {status}"
        products_main_page.keyboard.append([KeyboardButton(text=button_text)])
    return products_main_page
