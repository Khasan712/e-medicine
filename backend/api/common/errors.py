"""Every error of the API has one shape: {"error": "<code>", ...extra} (docs/api.md, Conventions)."""
import math

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404, JsonResponse
from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import set_rollback


class ApiError(exceptions.APIException):
    """An endpoint-specific error: `raise ApiError('min_order', min_order=50000)` →
    400 {"error": "min_order", "min_order": 50000}."""

    def __init__(self, code, status=400, **extra):
        super().__init__(code, code)
        self.code = code
        self.status_code = status
        self.extra = extra


def validation_fields(exc):
    """{"phone": ["required"], "items": [{"quantity": ["min_value"]}]} — the error codes of every field."""
    codes = exc.get_codes()
    if isinstance(codes, dict):
        return codes
    return {'non_field_errors': codes if isinstance(codes, list) else [codes]}


SIMPLE_CODES = (
    (exceptions.NotFound, 'not_found'),
    (exceptions.MethodNotAllowed, 'method_not_allowed'),
    (exceptions.ParseError, 'invalid_json'),
    (exceptions.UnsupportedMediaType, 'unsupported_media_type'),
    (exceptions.NotAcceptable, 'not_acceptable'),
)


def exception_handler(exc, context):
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()
    if not isinstance(exc, exceptions.APIException):
        return None  # a bug: Django answers 500 (server_error_view)

    status, headers = exc.status_code, {}
    if isinstance(exc, ApiError):
        body = {'error': exc.code, **exc.extra}
    elif isinstance(exc, exceptions.ValidationError):
        body = {'error': 'validation', 'fields': validation_fields(exc)}
    elif isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        body, status = {'error': 'auth_required'}, 401
        if getattr(exc, 'auth_header', None):
            headers['WWW-Authenticate'] = exc.auth_header
    elif isinstance(exc, exceptions.PermissionDenied):
        body = {'error': 'csrf_failed' if str(exc.detail).startswith('CSRF Failed') else 'forbidden'}
    elif isinstance(exc, exceptions.Throttled):
        body = {'error': 'too_many_requests'}
        if exc.wait:
            body['retry_after'] = headers['Retry-After'] = math.ceil(exc.wait)
    else:
        body = {'error': next((code for kind, code in SIMPLE_CODES if isinstance(exc, kind)), exc.default_code)}

    set_rollback()
    return Response(body, status=status, headers={key: str(value) for key, value in headers.items()})


def not_found_view(request, exception=None):
    """handler404 of every API: an unknown path."""
    return JsonResponse({'error': 'not_found'}, status=404)


def server_error_view(request):
    """handler500 of every API."""
    return JsonResponse({'error': 'server_error'}, status=500)
