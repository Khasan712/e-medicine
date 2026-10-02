import base64

from django.http import Http404, HttpResponse
from django.views import View

from apps.core.models import Product


class ProductImageView(View):
    """GET /api/v1/products/<id>/image — images of old products that only exist as base64 in the database."""

    def get(self, request, pk):
        product = Product.objects.filter(pk=pk).only('img_64').first()
        if not product or not product.img_64:
            raise Http404
        try:
            data = base64.b64decode(product.img_64)
        except ValueError:
            raise Http404
        if data[:4] == b'\x89PNG':
            content_type = 'image/png'
        elif data[8:12] == b'WEBP':
            content_type = 'image/webp'
        else:
            content_type = 'image/jpeg'
        response = HttpResponse(data, content_type=content_type)
        response['Cache-Control'] = 'public, max-age=86400'
        return response
