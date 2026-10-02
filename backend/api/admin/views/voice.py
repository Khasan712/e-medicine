"""Voice order entry of the point of sale (Gemini; a local parser for text when Gemini is not configured)."""
import json

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.response import Response

from apps.voice import understanding as voice
from ...common.errors import ApiError
from ...common.ratelimit import throttle
from ..serializers import VoiceStateSerializer
from .base import StaffView
from .sales import catalog_products

MAX_AUDIO_BYTES = 10 * 1024 * 1024
VOICE_REQUESTS_PER_HOUR = 300


def limit(request):
    throttle(f'voice:{request.user.pk}', VOICE_REQUESTS_PER_HOUR, 3600)


class VoiceTokenView(StaffView):
    @extend_schema(summary='A single-use Gemini Live session for live captions', request=None,
                   responses=inline_serializer('VoiceSession', {
                       'token': serializers.CharField(), 'url': serializers.CharField(),
                       'setup': serializers.DictField()}))
    def post(self, request):
        if not voice.is_configured():
            raise ApiError('not_configured')
        limit(request)
        try:
            session = voice.create_live_session(voice.build_catalog(catalog_products()))
        except voice.VoiceError as exc:
            raise ApiError(exc.code, 502)
        return Response(session)


def parse_state(value):
    if isinstance(value, dict):
        return value
    try:
        state = json.loads(value or '{}')
    except (TypeError, ValueError):
        return {}
    return state if isinstance(state, dict) else {}


class VoiceParseView(StaffView):
    @extend_schema(summary='Recorded clip or text → the complete updated order form', request=VoiceStateSerializer,
                   responses=inline_serializer('VoiceParse', {
                       'result': serializers.DictField(), 'engine': serializers.ChoiceField(['gemini', 'local'])}))
    def post(self, request):
        data = request.data
        audio = request.FILES.get('audio')
        audio_bytes = mime_type = None
        if audio:
            if audio.size > MAX_AUDIO_BYTES:
                raise ApiError('audio_too_large')
            audio_bytes, mime_type = audio.read(), audio.content_type
        text = str(data.get('text') or '')
        if not text.strip() and not audio_bytes:
            raise ApiError('empty')
        lang = data.get('lang') if data.get('lang') in ('uz', 'ru') else 'uz'
        limit(request)

        try:
            result, engine = voice.understand(
                voice.build_catalog(catalog_products()), parse_state(data.get('state')), text=text,
                audio=audio_bytes, mime_type=mime_type, lang=lang, live_text=str(data.get('live_text') or ''),
            )
        except voice.VoiceError as exc:
            raise ApiError(exc.code, 400 if exc.code in ('not_configured', 'empty_transcript') else 502)
        return Response({'result': result, 'engine': engine})
