from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin

from app.enums import UserRole, OrderEnum
from app.managers import CustomManager


class User(AbstractBaseUser, PermissionsMixin):
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    phone_number = models.CharField(max_length=100, unique=True)
    role = models.CharField(max_length=6, choices=UserRole.choices())
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_confirmed = models.BooleanField(default=False)

    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = ["role"]

    objects = CustomManager()

    def __str__(self):
        return self.phone_number


class Descriptions(models.Model):
    name_uz = models.CharField(max_length=100)
    name_ru = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.name_uz}: {self.name_ru}'


class Product(models.Model):
    img = models.ImageField(upload_to='products/')
    name_uz = models.CharField(max_length=255)
    name_ru = models.CharField(max_length=255)
    price = models.CharField(max_length=255)
    desc_uz = models.TextField()
    desc_ru = models.TextField()
    measure = models.ForeignKey(Descriptions, on_delete=models.DO_NOTHING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.name_uz}'


class Client(models.Model):
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=100, blank=True, null=True)
    tg_phone = models.CharField(max_length=100, blank=True, null=True)
    tg_id = models.CharField(max_length=100, blank=True, null=True)
    tg_nick = models.CharField(max_length=100, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    l_t = models.CharField(max_length=255, blank=True, null=True)
    e_t = models.CharField(max_length=255, blank=True, null=True)
    lang = models.CharField(max_length=10, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.id}'


class Order(models.Model):
    client = models.ForeignKey(Client, on_delete=models.DO_NOTHING)
    status = models.CharField(max_length=100, choices=OrderEnum.choices())
    phone = models.CharField(max_length=100, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    l_t = models.CharField(max_length=255, blank=True, null=True)
    e_t = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.id}'


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.DO_NOTHING)
    product = models.ForeignKey(Product, on_delete=models.DO_NOTHING)
    quantity = models.CharField(max_length=50, blank=True, null=True)
    price = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.id}'
