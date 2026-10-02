"""`python -m app` — runs every Telegram bot of the platform until SIGTERM / SIGINT."""
import asyncio
import logging
import signal
import sys

from .config import load_env_file, settings
from .db import create_database
from .telegram.api import BotFactory, hide_tokens
from .telegram.runtime import Runtime

logger = logging.getLogger('bots')


class RedactingFormatter(logging.Formatter):
    """Bot tokens never reach the logs (request errors may carry Bot API URLs)."""

    def format(self, record):
        return hide_tokens(super().format(record))


def setup_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(RedactingFormatter('%(asctime)s %(levelname)s %(name)s: %(message)s'))
    logging.basicConfig(level=settings.log_level, handlers=[handler], force=True)
    # aiogram reports every handled update at INFO.
    for name in ('aiogram.event', 'aiogram.dispatcher', 'httpx', 'google_genai'):
        logging.getLogger(name).setLevel(logging.WARNING)


async def serve():
    db = create_database()
    bot_factory = BotFactory()
    runtime = Runtime(db, bot_factory)
    loop = asyncio.get_running_loop()
    for signum in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(signum, runtime.request_stop)  # updates being handled are allowed to finish
    try:
        await runtime.run()
    finally:
        await bot_factory.close()
        await db.close()


def main():
    load_env_file()
    setup_logging()
    if not settings.secret_key:
        logger.error('SECRET_KEY is not set: the bot tokens cannot be decrypted')
        sys.exit(1)
    if not settings.platform_bot_token:
        logger.warning('PLATFORM_BOT_TOKEN is not set: the platform bot (creating bots for businesses) is off')
    if not settings.gemini_api_key:
        logger.info('GEMINI_API_KEY is not set: staff bots understand text orders only (local parser)')
    asyncio.run(serve())


if __name__ == '__main__':
    main()
