"""The async engine and sessions: one connection pool, a session per business schema."""
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from .models import TENANT


class Database:
    """`public()` — a session for the platform tables; `tenant(schema)` — a session in which every business
    table (mapped in the placeholder schema TENANT) means the table of that business's schema."""

    def __init__(self, engine: AsyncEngine):
        self.engine = engine
        self._public = async_sessionmaker(engine, expire_on_commit=False)
        self._tenants: dict[str, async_sessionmaker] = {}

    def public(self) -> AsyncSession:
        return self._public()

    def tenant(self, schema: str) -> AsyncSession:
        maker = self._tenants.get(schema)
        if maker is None:
            bind = self.engine.execution_options(schema_translate_map={TENANT: schema})
            maker = self._tenants[schema] = async_sessionmaker(bind, expire_on_commit=False)
        return maker()

    async def close(self):
        await self.engine.dispose()


def create_database(url=None, **engine_options) -> Database:
    options = {'pool_size': 20, 'max_overflow': 10, 'pool_pre_ping': True, 'pool_recycle': 1800}
    options.update(engine_options)
    return Database(create_async_engine(url or settings.database_url, **options))
