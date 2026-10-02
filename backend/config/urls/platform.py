"""The platform domain — our own panel (deliveryhub-ui) and the Django admin for our staff."""
from django.contrib import admin
from django.urls import path

from . import api

urlpatterns = api('api.platform.urls', 'config.urls.platform', 'DeliveryHub Platform API') + [
    path('django-admin/', admin.site.urls),
]

handler404 = 'api.common.errors.not_found_view'
handler500 = 'api.common.errors.server_error_view'
