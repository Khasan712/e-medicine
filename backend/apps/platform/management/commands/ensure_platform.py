import os

from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.platform.overview import businesses
from apps.platform.provisioning import add_domains, ensure_platform


class Command(BaseCommand):
    help = ('Makes sure the platform exists: our panel and its domains, the domains of every business for the '
            'current PLATFORM_DOMAIN, and (with PLATFORM_ADMIN_PHONE / PLATFORM_ADMIN_PASSWORD) our admin account. '
            'Safe to run on every start.')

    def handle(self, *args, **options):
        ensure_platform()
        for business in businesses():
            add_domains(business)
        if os.getenv('PLATFORM_ADMIN_PHONE') and os.getenv('PLATFORM_ADMIN_PASSWORD'):
            call_command('ensure_platform_admin', stdout=self.stdout)
        self.stdout.write(self.style.SUCCESS('platform ready'))
