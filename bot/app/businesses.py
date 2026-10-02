"""Businesses and their bots (public schema) and the public addresses of a business."""
from dataclasses import dataclass

from sqlalchemy import select, update

from .config import settings
from .db.models import PUBLIC, Business, BusinessBot
from .utils import now

KIND_SHOP = 'shop'
KIND_ADMIN = 'admin'


def subdomain(slug, kind):
    return slug if kind == KIND_SHOP else f'{slug}-admin'


def public_url(slug, kind):
    """https://<slug>.<PLATFORM_DOMAIN>/ — the address customers and Telegram (Mini Apps) use."""
    return f'https://{subdomain(slug, kind)}.{settings.platform_domain}/'


@dataclass(frozen=True)
class BusinessInfo:
    id: int
    name: str
    slug: str
    schema_name: str
    status: str = Business.STATUS_ACTIVE
    support_phone: str = ''

    @classmethod
    def of(cls, row: Business):
        return cls(id=row.id, name=row.name, slug=row.slug, schema_name=row.schema_name, status=row.status,
                   support_phone=row.support_phone or '')

    @property
    def is_active(self):
        return self.status == Business.STATUS_ACTIVE

    @property
    def shop_url(self):
        return public_url(self.slug, KIND_SHOP)

    @property
    def admin_url(self):
        return public_url(self.slug, KIND_ADMIN)

    @property
    def staff_app_url(self):
        """The admin panel as the staff bot's Mini App: its Telegram sign-in route."""
        return self.admin_url + 'tg'


def _with_business():
    return (select(BusinessBot, Business).join(Business, Business.id == BusinessBot.business_id)
            .where(Business.schema_name != PUBLIC))


async def load_bot(session, bot_id) -> tuple[BusinessBot, BusinessInfo] | None:
    row = (await session.execute(_with_business().where(BusinessBot.id == bot_id))).first()
    return (row[0], BusinessInfo.of(row[1])) if row else None


async def active_bots(session) -> list[tuple[BusinessBot, BusinessInfo]]:
    """The bots the service runs: active bots of active businesses."""
    rows = await session.execute(
        _with_business().where(BusinessBot.is_active.is_(True), Business.status == Business.STATUS_ACTIVE)
        .order_by(BusinessBot.id)
    )
    return [(bot, BusinessInfo.of(business)) for bot, business in rows]


async def mark_alive(session, bot_ids):
    """Heartbeat: the admin panels show a bot as working while last_seen_at is fresh."""
    if bot_ids:
        await session.execute(update(BusinessBot).where(BusinessBot.id.in_(list(bot_ids))).values(last_seen_at=now()))
