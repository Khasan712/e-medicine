from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Business data of one business (its own schema): staff users, catalog, customers, orders.
    The label stays "app" so table names and migration history match the existing database."""
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    label = 'app'
    verbose_name = 'Business data'
