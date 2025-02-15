from django.contrib import admin
from django.contrib.auth.models import Group
from django.contrib.auth.admin import UserAdmin
from .forms import ProductAdminForm, CustomUserCreationForm, CustomUserChangeForm
from .models import User, Product, Descriptions, Client, Order, OrderItem, Category
from django.utils.html import format_html


class CustomUserAdmin(UserAdmin):
    """ ✅ Custom User Admin - Only Admins Can Manage Users """
    add_form = CustomUserCreationForm  # ✅ Form for adding users
    form = CustomUserChangeForm  # ✅ Form for updating users
    model = User

    list_display = ("id", "phone_number", "first_name", "last_name", "role", "is_active", "is_staff", "created_at")
    list_filter = ("is_active", "is_staff", "role")

    fieldsets = (
        ("Personal Info", {"fields": ("phone_number", "first_name", "last_name", "role")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Important Dates", {"fields": ("created_at", "updated_at")}),
    )

    add_fieldsets = (
        ("User Info", {
            "classes": ("wide",),
            "fields": ("phone_number", "first_name", "last_name", "role", "password1", "password2"),
        }),
    )

    search_fields = ("phone_number", "first_name", "last_name")
    ordering = ("id",)
    readonly_fields = ("created_at", "updated_at")  # ✅ Make these fields read-only
    
    def save_model(self, request, obj, form, change):
        """ ✅ Auto set `is_staff=True` for managers """
        if obj.role in ["admin", "manager"]:
            obj.is_staff = True
        else:
            obj.is_staff = False
        obj.save()

    # ✅ Restrict Add Permission - Only Admins Can Add Users
    def has_add_permission(self, request):
        return request.user.is_authenticated and request.user.role == "admin"

    # ✅ Restrict Change Permission - Only Admins Can Modify Users
    def has_change_permission(self, request, obj=None):
        return request.user.is_authenticated and request.user.role == "admin"

    # ✅ Restrict Delete Permission - Only Admins Can Delete Users
    def has_delete_permission(self, request, obj=None):
        return request.user.is_authenticated and request.user.role == "admin"


admin.site.register(User, CustomUserAdmin)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    form = ProductAdminForm
    list_display = ("id", 'name_uz', 'name_ru', 'price', 'measure_uz', 'measure_ru', 'created_at')
    readonly_fields = ('display_base64_image',)
    exclude = ('img_64',)
    list_display_links = ("id", 'name_uz', 'name_ru')
    list_filter = ('measure',)

    def has_module_permission(self, request):
        """ ✅ Admins and Managers Can See This """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_change_permission(self, request, obj=None):
        """ ✅ Allow Managers to Edit Products """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_add_permission(self, request):
        """ ✅ Allow Managers to Add Products """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_delete_permission(self, request, obj=None):
        """ ✅ Allow Only Admins to Delete Products """
        return request.user.is_authenticated and request.user.role == "admin"

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


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", 'name_uz', 'name_ru', 'created_at')

    def has_module_permission(self, request):
        """ ✅ Admins and Managers Can See This """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_change_permission(self, request, obj=None):
        """ ✅ Allow Managers to Edit Products """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_add_permission(self, request):
        """ ✅ Allow Managers to Add Products """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_delete_permission(self, request, obj=None):
        """ ✅ Allow Only Admins to Delete Products """
        return request.user.is_authenticated and request.user.role == "admin"


@admin.register(Descriptions)
class DescriptionsAdmin(admin.ModelAdmin):
    list_display = ("id", 'name_uz', 'name_ru', 'created_at')

    def has_module_permission(self, request):
        """ ✅ Admins and Managers Can See This """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_change_permission(self, request, obj=None):
        """ ✅ Allow Managers to Edit Products """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_add_permission(self, request):
        """ ✅ Allow Managers to Add Products """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_delete_permission(self, request, obj=None):
        """ ✅ Allow Only Admins to Delete Products """
        return request.user.is_authenticated and request.user.role == "admin"


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("id", 'first_name', 'last_name', 'tg_phone', 'tg_nick', 'created_at', 'updated_at')

    def has_module_permission(self, request):
        """ ✅ Admins and Managers Can See This """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_change_permission(self, request, obj=None):
        """ ✅ Allow Managers to Edit Products """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_add_permission(self, request):
        """ ✅ Allow Managers to Add Products """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_delete_permission(self, request, obj=None):
        """ ✅ Allow Only Admins to Delete Products """
        return request.user.is_authenticated and request.user.role == "admin"


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
    list_display = ("id", "phone", "status", "created_at", "updated_at")
    readonly_fields = (
        "client_first_name", "client_tg_phone", "client_tg_id",
        "client_tg_nick", "phone", "location", "created_at", "updated_at"
    )
    list_display_links = ("id", "phone")
    list_filter = ('status',)
    fieldsets = (
        ("Order Details", {  # ✅ Order Info
            "fields": ("phone", "location", "status", "created_at", "updated_at")
        }),

        ("Client Information", {
            "fields": (
                "client_first_name", "client_tg_phone", "client_tg_id",
                "client_tg_nick"
            )
        }),

    )

    inlines = [OrderItemInline]

    def has_module_permission(self, request):
        """ ✅ Admins and Managers Can See This """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_change_permission(self, request, obj=None):
        """ ✅ Allow Managers to Edit Products """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_add_permission(self, request):
        """ ✅ Allow Managers to Add Products """
        return request.user.is_authenticated and request.user.role in ["admin", "manager"]

    def has_delete_permission(self, request, obj=None):
        """ ✅ Allow Only Admins to Delete Products """
        return request.user.is_authenticated and request.user.role == "admin"

    def client_first_name(self, obj):
        if not obj.client:
            return "No Client Data"

        return format_html(
            "<b>{}</b>",
            obj.client.first_name or "N/A",
        )

    client_first_name.short_description = "First name"

    def client_phone(self, obj):
        if not obj.client:
            return "No Client Data"

        return format_html(
            "<b>{}</b>",
            obj.client.phone or "N/A",
        )

    client_phone.short_description = "Phone"

    def client_tg_phone(self, obj):
        if not obj.client:
            return "No Client Data"

        return format_html(
            "<b>{}</b>",
            obj.client.tg_phone or "N/A",
        )

    client_tg_phone.short_description = "Telegram Phone"

    def client_tg_id(self, obj):
        if not obj.client:
            return "No Client Data"

        return format_html(
            "<b>{}</b>",
            obj.client.tg_id or "N/A",
        )

    client_tg_id.short_description = "Telegram Id"

    def client_tg_nick(self, obj):
        if not obj.client:
            return "No Client Data"

        return format_html(
            "<b>{}</b>",
            obj.client.tg_nick or "N/A",
        )

    client_tg_nick.short_description = "Telegram Nick"


# ✅ Remove default Groups (if not used)
admin.site.unregister(Group)
