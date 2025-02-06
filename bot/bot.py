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

from keyboards.markup.language import get_main_menu, get_products, language_markup, get_phone_markup
from commons.dictionary import DICTIONARY
from commons.constants import UZBEK_LANG, RUSSIAN_LANG

# Bot token can be obtained via https://t.me/BotFather
load_dotenv()
TOKEN = getenv("BOT_TOKEN")

# All handlers should be attached to the Router (or Dispatcher)

dp = Dispatcher()
# Initialize Bot instance with default bot properties which will be passed to all API calls
bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))


@dp.message(CommandStart())
async def command_start_handler(message: Message) -> None:
    await message.answer(
        text=f"{DICTIONARY['2'][UZBEK_LANG]}\n"
             f"{DICTIONARY['2'][RUSSIAN_LANG]}",
        reply_markup=language_markup()
    )


@dp.message((F.text == DICTIONARY['1'][UZBEK_LANG]) | (F.text == DICTIONARY['1'][RUSSIAN_LANG]))
async def language_handler(message: Message) -> None:
    lang = UZBEK_LANG if message.text == DICTIONARY['1'][UZBEK_LANG] else RUSSIAN_LANG
    print(lang)
    await message.answer(
        text=DICTIONARY['4'][lang],
        reply_markup=get_phone_markup()
    )


@dp.message(F.contact)
async def phone_number_handler(message: Message) -> None:
    if message.contact.user_id != message.from_user.id:
        await message.answer("❌ You must send your own phone number!")
        return
    lang = UZBEK_LANG
    await message.answer(text=DICTIONARY['8'][lang], reply_markup=get_main_menu(lang))


@dp.message((F.text == DICTIONARY['9'][UZBEK_LANG]) | (F.text == DICTIONARY['9'][RUSSIAN_LANG]))
async def main_menu_handler(message: Message) -> None:
    lang = UZBEK_LANG if message.text == DICTIONARY['9'][UZBEK_LANG] else RUSSIAN_LANG
    answer = DICTIONARY['8'][lang]
    await message.answer(text=answer, reply_markup=get_main_menu(lang))


@dp.message((F.text == DICTIONARY['5'][UZBEK_LANG]) | (F.text == DICTIONARY['5'][RUSSIAN_LANG]))
async def products_handler(message: Message) -> None:
    lang = UZBEK_LANG if message.text == DICTIONARY['5'][UZBEK_LANG] else RUSSIAN_LANG
    print(lang)
    await message.answer(
        text=DICTIONARY['10'][lang],
        reply_markup=get_products(lang)
    )


async def main() -> None:
    # And the run events dispatching
    await dp.start_polling(bot)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stdout)
    asyncio.run(main())
