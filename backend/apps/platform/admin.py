from django.contrib import admin

from .models import Business, BusinessBot, Domain


class DomainInline(admin.TabularInline):
    model = Domain
    extra = 0


class BotInline(admin.TabularInline):
    model = BusinessBot
    extra = 0
    fields = ('role', 'username', 'telegram_id', 'created_via', 'is_active', 'last_seen_at')
    readonly_fields = fields


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'schema_name', 'status', 'created_at')
    search_fields = ('name', 'slug')
    inlines = [DomainInline, BotInline]
