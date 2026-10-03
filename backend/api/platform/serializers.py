"""Platform API data (docs/api.md, Platform API)."""
from rest_framework import serializers

from apps.platform import provisioning
from apps.platform.bots import is_alive, missing_roles, platform_bot
from apps.platform.current import url_for
from apps.platform.models import Business, BusinessBot, Domain
from apps.platform.overview import business_stats, owner_of
from ..common.fields import ColorField, LimitedImageField, PhoneField
from ..common.representations import file_url, iso, person_name


class BotSerializer(serializers.Serializer):
    username = serializers.CharField()
    alive = serializers.BooleanField(help_text='The bot service polls it right now')
    created_via = serializers.ChoiceField(choices=[BusinessBot.VIA_MANAGED, BusinessBot.VIA_TOKEN])

    def to_representation(self, bot):
        return {'username': bot.username, 'alive': is_alive(bot), 'created_via': bot.created_via}


class StatsSerializer(serializers.Serializer):
    orders_today = serializers.IntegerField()
    revenue_today = serializers.IntegerField()
    orders_total = serializers.IntegerField()
    customers = serializers.IntegerField()


class LinksSerializer(serializers.Serializer):
    shop = serializers.URLField()
    admin = serializers.URLField()


class BotsSerializer(serializers.Serializer):
    client = BotSerializer(allow_null=True)
    admin = BotSerializer(allow_null=True)


class BusinessCardSerializer(serializers.Serializer):
    """Needs `request` in the context (addresses follow the style of the request: public or *.localhost)."""
    slug = serializers.CharField()
    name = serializers.CharField()
    status = serializers.ChoiceField(choices=[Business.STATUS_ACTIVE, Business.STATUS_SUSPENDED])
    logo = serializers.CharField(allow_null=True)
    brand_color = serializers.CharField()
    tagline = serializers.CharField()
    created_at = serializers.DateTimeField()
    links = LinksSerializer()
    stats = StatsSerializer()
    bots = BotsSerializer()

    def to_representation(self, business):
        request = self.context['request']
        bots = {bot.role: bot for bot in business.bots.all() if bot.is_active}
        return {
            'slug': business.slug,
            'name': business.name,
            'status': business.status,
            'logo': file_url(business.logo),
            'brand_color': business.brand_color,
            'tagline': business.tagline,
            'created_at': iso(business.created_at),
            'links': {'shop': url_for(request, business, Domain.KIND_SHOP),
                      'admin': url_for(request, business, Domain.KIND_ADMIN)},
            'stats': business_stats(business),
            'bots': {role: BotSerializer(bots[role]).data if role in bots else None
                     for role in (BusinessBot.ROLE_CLIENT, BusinessBot.ROLE_ADMIN)},
        }


class OwnerSerializer(serializers.Serializer):
    name = serializers.CharField()
    phone = serializers.CharField()


class PlatformBotSerializer(serializers.Serializer):
    username = serializers.CharField()


class BusinessDetailSerializer(BusinessCardSerializer):
    support_phone = serializers.CharField()
    delivery_time = serializers.CharField()
    min_order = serializers.IntegerField()
    owner = OwnerSerializer(allow_null=True)
    platform_bot = PlatformBotSerializer(allow_null=True)
    missing_roles = serializers.ListField(child=serializers.ChoiceField(choices=list(BusinessBot.ROLE_CHOICES)))

    def to_representation(self, business):
        owner = owner_of(business)
        me = platform_bot()
        return {
            **super().to_representation(business),
            'support_phone': business.support_phone,
            'delivery_time': business.delivery_time,
            'min_order': business.min_order,
            'owner': {'name': person_name(owner), 'phone': owner.phone_number} if owner else None,
            'platform_bot': {'username': me['username']} if me and me.get('username') else None,
            'missing_roles': missing_roles(business),
        }


# ---------------------------------------------------------------------------
# requests
# ---------------------------------------------------------------------------

class BusinessProfileSerializer(serializers.Serializer):
    """Editable profile; `logo: null` (or empty) removes the logo."""
    name = serializers.CharField(max_length=120)
    tagline = serializers.CharField(max_length=200, required=False, allow_blank=True)
    support_phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    delivery_time = serializers.CharField(max_length=20, required=False, allow_blank=True)
    min_order = serializers.IntegerField(min_value=0, max_value=100_000_000, required=False)
    brand_color = ColorField(required=False)
    logo = LimitedImageField(max_mb=2, required=False, allow_null=True)

    def validate_delivery_time(self, value):
        return value or '30–45'

    def apply(self, business):
        for field, value in self.validated_data.items():
            if field == 'logo':
                business.logo = value or ''
            else:
                setattr(business, field, value)
        business.save()
        return business


class SlugField(serializers.CharField):
    def __init__(self, **kwargs):
        kwargs.setdefault('max_length', 40)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        slug = super().to_internal_value(data).lower()
        try:
            provisioning.validate_slug(slug)
        except provisioning.ProvisioningError as exc:
            raise serializers.ValidationError(exc.code, code=exc.code)
        return slug


class BusinessCreateSerializer(BusinessProfileSerializer):
    slug = SlugField(help_text='3–30 characters: a-z, 0-9, "-"')
    owner_name = serializers.CharField(max_length=120)
    owner_phone = PhoneField()
    owner_password = serializers.CharField(min_length=8, max_length=128, required=False, allow_blank=True,
                                           trim_whitespace=False, help_text='Empty → generated')


class CredentialsSerializer(serializers.Serializer):
    phone = serializers.CharField()
    password = serializers.CharField()


class StatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[Business.STATUS_ACTIVE, Business.STATUS_SUSPENDED])


class DeleteBusinessSerializer(serializers.Serializer):
    confirm = serializers.CharField(max_length=40, help_text="The business's slug, typed by hand")


class BotConnectSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[BusinessBot.ROLE_CLIENT, BusinessBot.ROLE_ADMIN])
    token = serializers.CharField(max_length=100)


class PlatformUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    phone_number = serializers.CharField()
    first_name = serializers.CharField()

    def to_representation(self, user):
        return {'id': user.pk, 'phone_number': user.phone_number, 'first_name': user.first_name or ''}
