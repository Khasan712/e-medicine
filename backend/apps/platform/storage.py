"""Files of the platform itself (business logos) stay in media/public/ whichever schema is active: the default
storage (django-tenants) keeps files under media/<active schema>/, so a logo uploaded from our panel would get
a wrong address in the shop of that business."""
import os

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django_tenants.utils import get_public_schema_name


class PlatformStorage(FileSystemStorage):
    @property
    def base_location(self):
        return os.path.join(settings.MEDIA_ROOT, get_public_schema_name())

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    @property
    def base_url(self):
        return f'{settings.MEDIA_URL}{get_public_schema_name()}/'


platform_storage = PlatformStorage()
