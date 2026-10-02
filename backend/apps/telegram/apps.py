from django.apps import AppConfig


class TelegramConfig(AppConfig):
    """Telegram data of a business used by the bot service: staff links, invites, drafts, order cards and
    the outbox of customer messages. Label "adminbot" is kept."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.telegram'
    label = 'adminbot'
    verbose_name = 'Telegram'
