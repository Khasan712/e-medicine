"""The staff bot as the admin panel sees it: is it up, whose Telegram accounts are linked, invite links."""
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response

from apps.core.enums import UserRole
from apps.core.models import User
from apps.telegram.invites import admin_bot, create_invite, invite_url, is_alive
from apps.telegram.models import StaffLink
from apps.voice import understanding as voice
from ...common.errors import ApiError
from ...common.qr import qr_svg
from ...common.representations import iso, person_name
from ..serializers import InviteSerializer, LinkSerializer, LinkUpdateSerializer, PersonRefSerializer
from .base import StaffView


def is_admin(user):
    return user.role == UserRole.admin.value


def active_users():
    return User.objects.filter(is_active=True, is_deleted=False).order_by('first_name', 'phone_number')


class TelegramView(StaffView):
    @extend_schema(summary='The staff bot and linked Telegram accounts', responses=inline_serializer('Telegram', {
        'bot': inline_serializer('StaffBot', {'username': serializers.CharField(), 'alive': serializers.BooleanField()},
                                 allow_null=True),
        'voice_ready': serializers.BooleanField(),
        'my_links': LinkSerializer(many=True),
        'team_links': LinkSerializer(many=True),
        'users': PersonRefSerializer(many=True),
    }))
    def get(self, request):
        admin = is_admin(request.user)
        links = list(StaffLink.objects.select_related('user').order_by('user__first_name', 'created_at'))
        bot = admin_bot()
        return Response({
            'bot': {'username': bot.username, 'alive': is_alive(bot)} if bot else None,
            'voice_ready': voice.is_configured(),
            'my_links': LinkSerializer([link for link in links if link.user_id == request.user.pk], many=True).data,
            'team_links': LinkSerializer(links, many=True).data if admin else [],
            'users': [{'id': user.pk, 'name': person_name(user)} for user in active_users()] if admin else [],
        })


class InviteView(StaffView):
    @extend_schema(summary='A one-time link that connects a Telegram account (yours; admins — anyone\'s)',
                   request=InviteSerializer, responses={201: inline_serializer('Invite', {
                       'url': serializers.URLField(), 'qr_svg': serializers.CharField(),
                       'user': serializers.CharField(), 'expires_at': serializers.DateTimeField()})})
    def post(self, request):
        data = InviteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = request.user
        user_id = data.validated_data.get('user_id')
        if user_id and user_id != request.user.pk:
            if not is_admin(request.user):
                raise ApiError('forbidden', 403)
            user = get_object_or_404(active_users(), pk=user_id)
        if not admin_bot():
            raise ApiError('bot_missing')

        token, invite = create_invite(user, request.user)
        url = invite_url(token)
        return Response({'url': url, 'qr_svg': qr_svg(url), 'user': person_name(user),
                         'expires_at': iso(invite.expires_at)}, status=201)


class LinkView(StaffView):
    def editable_link(self, request, pk):
        link = get_object_or_404(StaffLink.objects.select_related('user'), pk=pk)
        if link.user_id != request.user.pk and not is_admin(request.user):
            raise ApiError('forbidden', 403)
        return link

    @extend_schema(summary='Turn order notifications on or off', request=LinkUpdateSerializer, responses=LinkSerializer)
    def patch(self, request, pk):
        link = self.editable_link(request, pk)
        data = LinkUpdateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        link.notify_orders = data.validated_data['notify_orders']
        link.save(update_fields=['notify_orders'])
        return Response(LinkSerializer(link).data)

    @extend_schema(summary='Unlink a Telegram account', responses={204: None})
    def delete(self, request, pk):
        self.editable_link(request, pk).delete()
        return Response(status=204)
