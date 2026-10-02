"""Settings from the environment. The variable names are the backend's (see ../.env.example), so one .env
serves both services."""
import os
from dataclasses import dataclass, field, fields
from pathlib import Path

from sqlalchemy.engine import URL

BASE_DIR = Path(__file__).resolve().parent.parent


def _env(name, default=''):
    return os.getenv(name, default)


def _env_list(name, default=''):
    return [value.strip() for value in _env(name, default).split(',') if value.strip()]


@dataclass
class Settings:
    postgres_db: str = 'deliveryhub'
    postgres_user: str = 'deliveryhub'
    postgres_password: str = ''
    postgres_host: str = 'db'
    postgres_port: int = 5432
    # Bot tokens are stored encrypted with a key derived from the backend's SECRET_KEY.
    secret_key: str = ''
    platform_bot_token: str = ''
    # Every business: <slug>.<domain> — shop / Mini App, <slug>-admin.<domain> — admin panel.
    platform_domain: str = 'portex.uz'
    # A local Bot API server or a fake one in tests.
    telegram_api_url: str = 'https://api.telegram.org'
    gemini_api_key: str = ''
    gemini_parse_model: str = 'gemini-3.5-flash-lite'
    gemini_parse_fallback_models: list = field(default_factory=lambda: ['gemini-3.1-flash-lite', 'gemini-3.5-flash'])
    # If the main model has not answered after this many seconds, the next model is asked in parallel.
    gemini_parse_hedge_seconds: float = 4.0
    gemini_transcribe_model: str = 'gemini-3.5-transcribe'
    # The businesses' local time (the backend's TIME_ZONE): "today", card times.
    time_zone: str = 'Asia/Tashkent'
    log_level: str = 'INFO'

    @classmethod
    def from_env(cls):
        return cls(
            postgres_db=_env('POSTGRES_DB', 'deliveryhub'),
            postgres_user=_env('POSTGRES_USER', 'deliveryhub'),
            postgres_password=_env('POSTGRES_PASSWORD'),
            postgres_host=_env('POSTGRES_HOST', 'db'),
            postgres_port=int(_env('POSTGRES_PORT', '5432')),
            secret_key=_env('SECRET_KEY'),
            platform_bot_token=_env('PLATFORM_BOT_TOKEN').strip(),
            platform_domain=_env('PLATFORM_DOMAIN', 'portex.uz'),
            telegram_api_url=_env('TELEGRAM_API_URL', 'https://api.telegram.org').rstrip('/'),
            gemini_api_key=_env('GEMINI_API_KEY'),
            gemini_parse_model=_env('GEMINI_PARSE_MODEL', 'gemini-3.5-flash-lite'),
            gemini_parse_fallback_models=_env_list('GEMINI_PARSE_FALLBACK_MODELS', 'gemini-3.1-flash-lite,gemini-3.5-flash'),
            gemini_parse_hedge_seconds=float(_env('GEMINI_PARSE_HEDGE_SECONDS', '4')),
            gemini_transcribe_model=_env('GEMINI_TRANSCRIBE_MODEL', 'gemini-3.5-transcribe'),
            time_zone=_env('TIME_ZONE', 'Asia/Tashkent'),
            log_level=_env('LOG_LEVEL', 'INFO').upper(),
        )

    def reload(self):
        """Re-reads the environment into this object (every module shares it)."""
        fresh = self.from_env()
        for item in fields(self):
            setattr(self, item.name, getattr(fresh, item.name))

    @property
    def database_url(self):
        return URL.create(
            'postgresql+asyncpg', username=self.postgres_user, password=self.postgres_password or None,
            host=self.postgres_host, port=self.postgres_port, database=self.postgres_db,
        )


def load_env_file():
    """Local runs: the repository's .env (like the backend). Variables already set win."""
    try:
        import dotenv
    except ImportError:  # pragma: no cover
        return
    dotenv.load_dotenv(BASE_DIR.parent / '.env')
    settings.reload()


settings = Settings.from_env()
