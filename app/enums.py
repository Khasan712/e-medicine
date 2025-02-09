from enum import Enum


class UserRole(Enum):
    admin = 'admin'
    manager = 'manager'

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
    ordered = 'ordered'
    on_the_way = 'on_the_way'
    completed = 'completed'
    rejected = 'rejected'
    new = 'new'

    @classmethod
    def choices(cls):
        return (
            (key.value, key.name)
            for key in cls
        )
