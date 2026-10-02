"""<slug>.<domain> — the shop of a business (client-ui)."""
from . import api

urlpatterns = api('api.shop.urls', 'config.urls.shop', 'DeliveryHub Shop API')

handler404 = 'api.common.errors.not_found_view'
handler500 = 'api.common.errors.server_error_view'
