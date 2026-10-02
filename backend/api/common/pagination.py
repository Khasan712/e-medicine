from django.core.paginator import Paginator
from rest_framework.pagination import BasePagination
from rest_framework.response import Response


class Pagination(BasePagination):
    """?page=1&page_size=20 → {"count", "page", "pages", "results"}. A page out of range gives the last page
    (a list that shrank under a filter never answers 404)."""
    page_size = 20
    max_page_size = 100

    def get_page_size(self, request):
        try:
            size = int(request.query_params.get('page_size') or self.page_size)
        except ValueError:
            size = self.page_size
        return max(1, min(size, self.max_page_size))

    def paginate_queryset(self, queryset, request, view=None):
        self.page = Paginator(queryset, self.get_page_size(request)).get_page(request.query_params.get('page'))
        return list(self.page)

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'page': self.page.number,
            'pages': self.page.paginator.num_pages,
            'results': data,
        })

    def get_paginated_response_schema(self, schema):
        return {
            'type': 'object',
            'required': ['count', 'page', 'pages', 'results'],
            'properties': {
                'count': {'type': 'integer', 'example': 135},
                'page': {'type': 'integer', 'example': 1},
                'pages': {'type': 'integer', 'example': 7},
                'results': schema,
            },
        }

    def get_schema_operation_parameters(self, view):
        return [
            {'name': 'page', 'in': 'query', 'required': False, 'schema': {'type': 'integer', 'minimum': 1}},
            {'name': 'page_size', 'in': 'query', 'required': False,
             'schema': {'type': 'integer', 'minimum': 1, 'maximum': self.max_page_size}},
        ]
