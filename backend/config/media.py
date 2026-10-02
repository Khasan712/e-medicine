"""Uploaded files in development (`SERVE_MEDIA`); in production the web container serves /media/ itself."""
from django.conf import settings
from django.urls import re_path
from django.views.static import serve

urlpatterns = [
    re_path(rf'^{settings.MEDIA_URL.strip("/")}/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
