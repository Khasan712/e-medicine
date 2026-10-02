"""Customers sign in to a shop with a signed bearer token (docs/api.md, Authentication).

Customers are `Client` rows (the same table the customers' bot uses), not Django users. A token, not a cookie:
the shop also runs inside the Telegram Mini App iframe (Telegram Web/Desktop), where cookies are not reliable.
"""
from django.core import signing
from django.db import connection
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import BaseAuthentication

from apps.core.models import Client

TOKEN_SALT = 'shop.client-token'
TOKEN_MAX_AGE = 60 * 60 * 24 * 90  # 90 days


def _salt():
    # Bound to the business: a token of one shop is not valid in another (client ids repeat across schemas).
    return f'{TOKEN_SALT}:{connection.schema_name}'


def issue_token(client):
    return signing.dumps({'cid': client.pk}, salt=_salt())


class Customer:
    """`request.user` of the shop API for a signed-in customer; the Client is `request.user.client`."""
    is_authenticated = True
    is_anonymous = False

    def __init__(self, client):
        self.client = client
        self.pk = client.pk


class CustomerTokenAuthentication(BaseAuthentication):
    """`Authorization: Bearer <token>`. A missing, foreign or expired token means an anonymous visitor: the
    catalog stays open, endpoints that need a customer answer 401."""

    def authenticate(self, request):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return None
        token = header[7:].strip()
        try:
            data = signing.loads(token, salt=_salt(), max_age=TOKEN_MAX_AGE)
        except signing.BadSignature:
            return None
        client = Client.objects.filter(pk=data.get('cid')).first()
        return (Customer(client), token) if client else None

    def authenticate_header(self, request):
        return 'Bearer'


class CustomerTokenScheme(OpenApiAuthenticationExtension):
    target_class = CustomerTokenAuthentication
    name = 'customerToken'

    def get_security_definition(self, auto_schema):
        return {'type': 'http', 'scheme': 'bearer'}
