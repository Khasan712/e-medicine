import re

from rest_framework import serializers

from apps.core.utils import normalize_phone

UZ_PHONE_RE = re.compile(r'^\+998\d{9}$')
COLOR_RE = re.compile(r'^#[0-9a-fA-F]{6}$')


class PhoneField(serializers.CharField):
    """A phone number typed loosely ("90 123 45 67") → "+998901234567"; error code `invalid`."""

    def __init__(self, uz_only=False, **kwargs):
        kwargs.setdefault('max_length', 30)
        super().__init__(**kwargs)
        self.uz_only = uz_only

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if not value:
            return value
        phone = normalize_phone(value)
        if not phone or (self.uz_only and not UZ_PHONE_RE.match(phone)):
            raise serializers.ValidationError('invalid', code='invalid')
        return phone


class LimitedImageField(serializers.ImageField):
    """An image up to `max_mb` megabytes; error code `too_large`."""

    def __init__(self, max_mb=5, **kwargs):
        super().__init__(**kwargs)
        self.max_bytes = max_mb * 1024 * 1024

    def to_internal_value(self, data):
        image = super().to_internal_value(data)
        if image.size > self.max_bytes:
            raise serializers.ValidationError('too_large', code='too_large')
        return image


class ColorField(serializers.CharField):
    """"#ff6b00" (or "" for none); error code `invalid`."""

    def __init__(self, **kwargs):
        kwargs.setdefault('max_length', 7)
        kwargs.setdefault('allow_blank', True)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if value and not COLOR_RE.match(value):
            raise serializers.ValidationError('invalid', code='invalid')
        return value.lower()
