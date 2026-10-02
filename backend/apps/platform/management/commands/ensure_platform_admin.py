import os

from django.core.management.base import BaseCommand, CommandError

from apps.core.models import User
from apps.core.utils import normalize_phone


class Command(BaseCommand):
    help = 'Creates or updates our platform panel account from PLATFORM_ADMIN_PHONE / PLATFORM_ADMIN_PASSWORD.'

    def handle(self, *args, **options):
        phone = normalize_phone(os.getenv('PLATFORM_ADMIN_PHONE'))
        password = os.getenv('PLATFORM_ADMIN_PASSWORD', '')
        if not phone or len(password) < 8:
            raise CommandError('Set PLATFORM_ADMIN_PHONE and PLATFORM_ADMIN_PASSWORD (8+ characters) in .env')
        user = User.objects.filter(phone_number=phone).first()
        if user is None:
            User.objects.create_superuser(phone_number=phone, role='admin', password=password, first_name='Platform')
            self.stdout.write(self.style.SUCCESS(f'platform admin {phone} created'))
        else:
            user.set_password(password)
            user.is_superuser = user.is_staff = user.is_active = True
            user.save()
            self.stdout.write(self.style.SUCCESS(f'platform admin {phone} updated'))
