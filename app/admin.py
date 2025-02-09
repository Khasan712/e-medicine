from django.contrib import admin

from .forms import ProductAdminForm
from .models import User, Product, Descriptions, Client, Order, OrderItem
from django.utils.html import format_html


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", 'first_name', 'last_name', 'phone_number', 'role', 'is_active')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    form = ProductAdminForm
    list_display = ("id", 'name_uz', 'name_ru', 'price', 'measure_uz', 'measure_ru', 'created_at')
    readonly_fields = ('display_base64_image',)

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

    def display_base64_image(self, obj):
        """ Display the Base64 image in Admin """
        if obj.img_64:
            return format_html(
                '<img src="data:image/png;base64,{}" style="max-width: 200px; max-height: 200px;" />',
                obj.img_64
            )
        return "No Image"

    display_base64_image.short_description = "Product Image"

    def get_fields(self, request, obj=None):
        """ Show the Base64 image inside the product detail page """
        fields = super().get_fields(request, obj)
        return ('display_base64_image',) + tuple(fields)


@admin.register(Descriptions)
class DescriptionsAdmin(admin.ModelAdmin):
    list_display = ("id", 'name_uz', 'name_ru', 'created_at')


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("id", 'first_name', 'last_name', 'tg_phone', 'tg_nick', 'created_at', 'updated_at')


class OrderItemInline(admin.TabularInline):  # ✅ Use `StackedInline` if you prefer
    model = OrderItem
    extra = 0  # ✅ No empty extra fields
    can_delete = False  # ✅ Prevents deletion
    readonly_fields = ('product_image', 'product', 'quantity', 'price', 'created_at', 'updated_at')  # ✅ All fields read-only
    fields = ('product_image', 'product', 'quantity', 'price', 'created_at', 'updated_at')  # ✅ Fields to display

    def product_image(self, obj):
        """ ✅ Display Base64 Product Image in Admin """
        if obj.product and obj.product.img_64:  # ✅ Check if product has a Base64 image
            return format_html(
                '<img src="data:image/png;base64,{}" width="100" style="border-radius: 5px;" />',
                obj.product.img_64
            )
        return "No Image"

    product_image.short_description = "Product Image"

    def has_add_permission(self, request, obj=None):
        return False  # ✅ Prevent adding new OrderItems

    def has_change_permission(self, request, obj=None):
        return False  # ✅ Prevent updating OrderItems


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "client", "phone", "status", "created_at", "updated_at")
    readonly_fields = ("client_info", "phone", "location", "created_at", "updated_at")
    fieldsets = (
        ("Order Details", {  # ✅ Order Info
            "fields": ("phone", "location", "status", "created_at", "updated_at")
        }),

        ("Client Information", {  # ✅ Show Client Info First
            "fields": ("client_info",)
        }),

    )

    inlines = [OrderItemInline]  # ✅ OrderItems Inline

    def client_info(self, obj):
        """ ✅ Display Client Info Inside Order Page (Properly Rendered) """
        if not obj.client:
            return "No Client Data"

        return format_html(
            "<b>Name:</b> {} {}<br>"
            "<b>Phone:</b> {}<br>"
            "<b>Telegram ID:</b> {}<br>"
            "<b>Telegram Nick:</b> {}<br>",
            obj.client.first_name or "N/A",
            obj.client.last_name or "N/A",
            obj.client.phone or "N/A",
            obj.client.tg_id or "N/A",
            obj.client.tg_nick or "N/A"
        )

    client_info.short_description = "Client Info"  # ✅ Custom label


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("id", 'order', 'product', 'quantity', 'price', 'created_at', 'updated_at')


