"""Fixed-window rate limits in the cache (Redis in production, shared by all workers). Keys are kept apart per
business by the cache key function (django_tenants.cache.make_key)."""
from django.core.cache import cache

from .errors import ApiError


def client_ip(request):
    # The web container (Caddy) replaces X-Forwarded-For with the address of the caller.
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    return forwarded.split(',')[0].strip() or request.META.get('REMOTE_ADDR')


def rate_limited(key, limit, window_seconds):
    """Counts a hit; True when `key` has been hit more than `limit` times in the current window."""
    cache_key = f'rl:{key}'
    cache.add(cache_key, 0, window_seconds)
    try:
        count = cache.incr(cache_key)
    except ValueError:  # expired between add() and incr()
        cache.set(cache_key, 1, window_seconds)
        count = 1
    return count > limit


def throttle(key, limit, window_seconds):
    if rate_limited(key, limit, window_seconds):
        raise ApiError('too_many_requests', 429)
