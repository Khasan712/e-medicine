from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from commons.dictionary import DICTIONARY
from commons.constants import UZBEK_LANG, RUSSIAN_LANG


def get_quantity_keyboard(product_id, quantity, lang):
    inline_kb_list = [
        [
            InlineKeyboardButton(text="➖", callback_data=f"decrease_{product_id}"),
            InlineKeyboardButton(text=f"{quantity}", callback_data="quantity_placeholder"),
            InlineKeyboardButton(text="➕", callback_data=f"increase_{product_id}")
        ],
        [
            InlineKeyboardButton(text=DICTIONARY['16'][lang], callback_data=f"add_to_cart_{product_id}")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=inline_kb_list)


def get_quantity_and_remove_keyboard(product_id, quantity):
    inline_kb_list = [
        [
            InlineKeyboardButton(text="➖", callback_data=f"decrease_{product_id}"),
            InlineKeyboardButton(text=f"{quantity}", callback_data="quantity_placeholder"),
            InlineKeyboardButton(text="➕", callback_data=f"increase_{product_id}")
        ],
        [
            InlineKeyboardButton(text="🛒", callback_data=f"add_to_cart_{product_id}"),
            InlineKeyboardButton(text="❌", callback_data=f"remove_from_cart_{product_id}")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=inline_kb_list)


def get_order_items_keyboard(order_items, lang):
    inline_keyboards = [
        [InlineKeyboardButton(text=DICTIONARY['25'][lang], callback_data=f"ordering_products")],
        [InlineKeyboardButton(text=DICTIONARY['18'][lang], callback_data=f"cleaning_cart")],
    ]
    for order_item in order_items:
        name = order_item.product.name_uz if lang == UZBEK_LANG else order_item.product.name_ru
        inline_keyboards += [
            [
                InlineKeyboardButton(text="➖", callback_data=f"order_item_decrease_{order_item.product.id}"),
                InlineKeyboardButton(text=f"{name}", callback_data="quantity_placeholder"),
                InlineKeyboardButton(text="➕", callback_data=f"order_item_increase_{order_item.product.id}")
            ]
        ]

    return InlineKeyboardMarkup(inline_keyboard=inline_keyboards)


def get_confirmation_emojis():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text='❌', callback_data='reject_cleaning_cart'),
                InlineKeyboardButton(text='✅', callback_data='confirm_cleaning_cart')
            ]
        ]
    )


def get_confirmation_location():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text='✍️', callback_data='order_location_edit'),
                InlineKeyboardButton(text='✅', callback_data='order_location_confirm')
            ]
        ]
    )


def get_order_confirmation_phone():
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text='✍️', callback_data='edit_order_phone'),
                InlineKeyboardButton(text='✅', callback_data='confirm_order_phone')
            ]
        ]
    )


def get_confirm_order_keyboard(client):
    inline_keyboards = [
        [
            InlineKeyboardButton(text=DICTIONARY['38'][client.lang], callback_data=f"edit_order_firstname"),
        ],
        [
            InlineKeyboardButton(text=DICTIONARY['26'][client.lang], callback_data=f"edit_order_phone"),
        ],
        [
            InlineKeyboardButton(text=DICTIONARY['27'][client.lang], callback_data=f"edit_order_location"),
        ],
        [InlineKeyboardButton(text=DICTIONARY['17'][client.lang], callback_data=f"confirm_order")],
    ]
    return InlineKeyboardMarkup(inline_keyboard=inline_keyboards)

