from enum import Enum


class UserRole(Enum):
    admin = 'admin'
    client = 'client'
    seller = 'seller'

    @classmethod
    def choices(cls):
        return (
            (key.value, key.name)
            for key in cls
        )


class LanguageEnum(Enum):
    uz = 'uz'
    ru = 'ru'

    @classmethod
    def choices(cls):
        return (
            (key.value, key.name)
            for key in cls
        )


class OrderEnum(Enum):
    new = 'new'
    ordered = 'ordered'
    rejected = 'rejected'
    completed = 'completed'

    @classmethod
    def choices(cls):
        return (
            (key.value, key.name)
            for key in cls
        )
