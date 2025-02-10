from django.contrib.auth.base_user import BaseUserManager
from django.db.models.query import QuerySet

from app.enums import LanguageEnum


class CustomManager(BaseUserManager):

    def create_user(self, phone_number, role, password, **extra_fields):
        if not phone_number:
            raise ValueError('User must have phone number')
        if not role:
            raise ValueError("User must have role")
        if not password:
            raise ValueError("User must have password")

        extra_fields.setdefault('is_staff', True)
        user = self.model(
            phone_number=phone_number,
            role=role,
            **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, role, password, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(phone_number, role, password, **extra_fields)


class UzDescriptionsManager(CustomManager.from_queryset(QuerySet)):
    def get_queryset(self):
        return super().get_queryset().filter(lang=LanguageEnum.uz)


class RuDescriptionsManager(CustomManager.from_queryset(QuerySet)):
    def get_queryset(self):
        return super().get_queryset().filter(lang=LanguageEnum.ru)

