"""Commands, descriptions and the Mini App menu button of a business's bots, set whenever the service starts
polling a bot. Telegram errors are logged, not raised: the bot works without them."""
import logging

from aiogram.exceptions import TelegramAPIError, TelegramNetworkError, TelegramUnauthorizedError
from aiogram.methods import SetChatMenuButton, SetMyCommands, SetMyDescription, SetMyShortDescription
from aiogram.types import BotCommand, MenuButtonWebApp, WebAppInfo

from app.customer import texts as customer_texts
from app.db.models import BusinessBot
from app.staff import texts as staff_texts
from .api import describe

logger = logging.getLogger('bots')

# The default (no language_code) is Uzbek; Russian-speaking users get the Russian texts.
LANGUAGES = (('uz', None), ('ru', 'ru'))


def staff_methods(business):
    t = staff_texts.t
    methods = []
    for lang, language_code in LANGUAGES:
        commands = [BotCommand(command=command, description=t(lang, f'cmd_{command}'))
                    for command in ('start', 'today', 'stats', 'lang')]
        methods += [
            SetMyCommands(commands=commands, language_code=language_code),
            SetMyDescription(description=t(lang, 'bot_description'), language_code=language_code),
            SetMyShortDescription(short_description=t(lang, 'bot_short_description'), language_code=language_code),
        ]
    # The admin panel as a Mini App (its Telegram sign-in route).
    methods.append(SetChatMenuButton(menu_button=MenuButtonWebApp(
        text=t('uz', 'btn_panel'), web_app=WebAppInfo(url=business.staff_app_url))))
    return methods


def customer_methods(business):
    t = customer_texts.t
    methods = []
    for lang, language_code in LANGUAGES:
        commands = [BotCommand(command='start', description=t(lang, 'cmd_start')),
                    BotCommand(command='lang', description=t(lang, 'cmd_lang'))]
        methods += [
            SetMyCommands(commands=commands, language_code=language_code),
            SetMyDescription(description=t(lang, 'description', name=business.name), language_code=language_code),
            SetMyShortDescription(short_description=t(lang, 'short_description', name=business.name),
                                  language_code=language_code),
        ]
    # The shop as a Mini App.
    methods.append(SetChatMenuButton(menu_button=MenuButtonWebApp(
        text=t('uz', 'btn_shop'), web_app=WebAppInfo(url=business.shop_url))))
    return methods


async def configure_bot(bot, role, business, username=''):
    methods = staff_methods(business) if role == BusinessBot.ROLE_ADMIN else customer_methods(business)
    for method in methods:
        try:
            await bot(method)
        except (TelegramUnauthorizedError, TelegramNetworkError) as exc:  # the next calls would fail the same way
            logger.warning('Configuring @%s failed: %s', username, describe(exc))
            return
        except TelegramAPIError as exc:
            logger.warning('Configuring @%s (%s) failed: %s', username, method.__api_method__, describe(exc))
