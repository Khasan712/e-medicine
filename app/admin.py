from django.contrib import admin
from .models import User, Product, Descriptions


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", 'first_name', 'last_name', 'phone_number', 'role', 'is_active')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", 'name_uz', 'name_ru', 'price', 'measure_uz', 'measure_ru', 'created_at')

    def measure_uz(self, obj):
        try:
            return obj.measure.name_uz
        except Exception as e:
            print(str(e))
            return '-'
    measure_uz.short_description = 'measure uz'

    def measure_ru(self, obj):
        try:
            return obj.measure.name_ru
        except Exception as e:
            print(str(e))
            return '-'
    measure_ru.short_description = 'measure ru'


@admin.register(Descriptions)
class DescriptionsAdmin(admin.ModelAdmin):
    list_display = ("id", 'name_uz', 'name_ru', 'created_at')
