from aiogram.types import KeyboardButton, ReplyKeyboardMarkup
from commons.constants import UZBEK_LANG, RUSSIAN_LANG
from commons.dictionary import DICTIONARY


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


def get_products(lang):
    products = [
        "Paracetamol", "Ibuprofen", "Aspirin", "Amoxicillin", "Metformin",
        "Omeprazole", "Cetirizine", "Loratadine", "Diclofenac", "Prednisolone",
        "Azithromycin", "Atorvastatin", "Furosemide", "Losartan", "Clopidogrel",
        "Simvastatin", "Levothyroxine", "Ranitidine", "Amlodipine", "Doxycycline"
    ]

    # Generate product buttons (each product on a new row)
    products_keyboard = [[KeyboardButton(text=product)] for product in products]

    # Add "Back" button at the first row
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=DICTIONARY['9'][lang])]] + products_keyboard,
        resize_keyboard=True
    )
