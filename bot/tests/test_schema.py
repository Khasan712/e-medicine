from sqlalchemy import text

from app.db.models import Order


async def test_tables_exist_in_every_schema(db, shop, other_shop):
    async with db.engine.connect() as conn:
        rows = (await conn.execute(text(
            "SELECT table_schema, count(*) FROM information_schema.tables "
            "WHERE table_schema IN ('public', 'test_shop', 'other_shop') GROUP BY table_schema ORDER BY 1"
        ))).all()
    assert [schema for schema, _ in rows] == ['other_shop', 'public', 'test_shop']
    assert await shop.count(Order) == 0
