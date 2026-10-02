"""Session sign-in of the admin and platform APIs (docs/api.md, Authentication): CSRF cookie, login, logout, me.
Sessions and users live in the schema of the host's business, so an account of one business means nothing in
another."""
from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.authentication import SessionScheme
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import authentication, serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.utils import normalize_phone
from .errors import ApiError
from .ratelimit import client_ip, throttle

LOGIN_ATTEMPTS = 10  # per address and phone number in LOGIN_WINDOW
LOGIN_WINDOW = 15 * 60


class SessionAuthentication(authentication.SessionAuthentication):
    """DRF session authentication that also shuts out deleted users (inactive ones are already shut out)."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result and getattr(result[0], 'is_deleted', False):
            return None
        return result


class SessionAuthenticationScheme(SessionScheme):
    target_class = SessionAuthentication


def enforce_csrf(request):
    """Raises PermissionDenied ("CSRF Failed: …" → 403 csrf_failed) unless X-CSRFToken matches the cookie."""
    SessionAuthentication().enforce_csrf(request)


class CsrfView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(summary='Set the csrftoken cookie', responses={204: None})
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response(status=204)


class LoginSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=30)
    password = serializers.CharField(max_length=128, trim_whitespace=False)


class BaseLoginView(APIView):
    """POST {"phone", "password"} → the `me` payload of the API; 400 invalid_credentials."""
    authentication_classes = []  # CSRF is checked explicitly: there is no session yet
    permission_classes = [AllowAny]

    def can_sign_in(self, user):
        raise NotImplementedError

    def me(self, request, user):
        raise NotImplementedError

    def post(self, request):
        enforce_csrf(request)
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        phone = normalize_phone(data.validated_data['phone']) or data.validated_data['phone'].strip()
        throttle(f'login:{client_ip(request)}:{phone}', LOGIN_ATTEMPTS, LOGIN_WINDOW)

        user = authenticate(request, username=phone, password=data.validated_data['password'])
        if user is None or getattr(user, 'is_deleted', False) or not self.can_sign_in(user):
            raise ApiError('invalid_credentials')
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        return Response(self.me(request, user))


class LogoutView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]

    @extend_schema(summary='Sign out', request=None, responses={204: None})
    def post(self, request):
        logout(request)
        return Response(status=204)


def login_schema(response):
    return extend_schema(
        summary='Sign in with phone and password',
        request=LoginSerializer,
        responses={200: response, 400: inline_serializer('LoginError', {'error': serializers.CharField()})},
    )
