from django.apps import AppConfig


class PlatformConfig(AppConfig):
    """The platform (public schema): businesses, their domains and Telegram bots. Label "hub" is kept."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.platform'
    label = 'hub'
    verbose_name = 'DeliveryHub platform'
