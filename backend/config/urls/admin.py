"""<slug>-admin.<domain> — the admin panel of a business (admin-ui)."""
from . import api

urlpatterns = api('api.admin.urls', 'config.urls.admin', 'DeliveryHub Admin API')

handler404 = 'api.common.errors.not_found_view'
handler500 = 'api.common.errors.server_error_view'
