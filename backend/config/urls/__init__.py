"""One URL configuration per API; apps.platform.middleware picks one by the host (docs/api.md)."""
from django.conf import settings
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView

from config.media import urlpatterns as media_urlpatterns


def api(module, urlconf, title):
    """/api/v1/... of one API, its OpenAPI schema and, in development, the uploaded files."""
    patterns = [
        path('api/v1/', include(module)),
        path('api/v1/schema/', SpectacularAPIView.as_view(
            urlconf=urlconf, custom_settings={'TITLE': title}), name='schema'),
    ]
    return patterns + (media_urlpatterns if settings.SERVE_MEDIA else [])
