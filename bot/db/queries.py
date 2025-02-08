from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlalchemy.sql import func, or_
from sqlalchemy import delete
from db.models import Client, Product, Descriptions, Order, OrderItem
from db.setup import get_db_session
from commons.constants import UZBEK_LANG, RUSSIAN_LANG, NEW_ORDER_STATUS


async def create_client(session: AsyncSession, first_name, last_name, tg_id, tg_nick, lang=None):
    client = Client(
        first_name=first_name,
        last_name=last_name,
        tg_id=tg_id,
        tg_nick=tg_nick,
        created_at=func.now(),
        updated_at=func.now(),
        lang=lang
    )
    session.add(client)
    await session.commit()
    return client


async def save_client_lang(session: AsyncSession, lang):
    client = Client(
        lang=lang,
        updated_at=func.now(),
    )
    session.add(client)
    await session.commit()
    return client


async def get_client(session: AsyncSession, tg_id):
    result = await session.execute(select(Client).filter_by(tg_id=str(tg_id)))
    return result.scalars().first()


async def get_products(session: AsyncSession, lang, name=None):
    query = True
    if name:
        name = f"%{name.split('/')[0].strip()}%"
        query = or_(
            Product.name_uz.ilike(name),
            Product.name_ru.ilike(name),
            Product.desc_uz.ilike(name),
            Product.desc_ru.ilike(name)
        )

    if lang == UZBEK_LANG:
        result = await session.execute(
            select(Product.id, Product.name_uz, Product.name_ru).filter(query).order_by(Product.created_at.desc())
        )
        return result.all()
    else:
        result = await session.execute(
            select(Product.id, Product.name_uz, Product.name_ru).filter(query).order_by(Product.created_at.desc())
        )
        return result.all()


async def get_product_by_id(session: AsyncSession, product_id, lang):
    result = await session.execute(
        select(Product)
        .options(joinedload(Product.measure))  # Explicitly join with the measure relationship
        .filter_by(id=product_id)
    )
    product = result.scalars().first()
    if product:
        if lang == UZBEK_LANG:
            data = {
                'id': product.id,
                'name': product.name_uz,
                'price': product.price,
                'desc': product.desc_uz,
                'measure': product.measure.name_uz,
                'img': product.img
            }
            return data
        else:
            return {
                'id': product.id,
                'name': product.name_ru,
                'price': product.price,
                'desc': product.desc_ru,
                'measure': product.measure.name_ru,
                'img': product.img
            }
    return None


async def get_product(session: AsyncSession, lang, name: str):
    name = f"%{name.split('/')[0].split('-')[1].strip()}%"
    result = await session.execute(
        select(Product)
        .options(joinedload(Product.measure))  # Explicitly join with the measure relationship
        .filter(
            or_(
                Product.name_uz.ilike(name),  # ✅ Case-insensitive search
                Product.name_ru.ilike(name)
            )
        )
    )
    product = result.scalars().first()
    if product:
        if lang == UZBEK_LANG:
            data = {
                'id': product.id,
                'name': product.name_uz,
                'price': product.price,
                'desc': product.desc_uz,
                'measure': product.measure.name_uz,
                'img': product.img
            }
            return data
        else:
            return {
                'id': product.id,
                'name': product.name_ru,
                'price': product.price,
                'desc': product.desc_ru,
                'measure': product.measure.name_ru,
                'img': product.img
            }
    return None


async def fetch_or_create_client(user_id, first_name, last_name, username):
    """Fetch client from DB or create a new one if not exists."""
    async for session in get_db_session():
        client = await get_client(session, user_id)
        if not client:
            client = await create_client(
                session=session,
                first_name=first_name,
                last_name=last_name,
                tg_id=str(user_id),
                tg_nick=username,
            )
        return client


async def fetch_or_create_order(session: AsyncSession, client):
    result = await session.execute(select(Order).filter_by(client_id=client.id, status=NEW_ORDER_STATUS))
    order = result.scalars().first()
    if order:
        return order
    order = Order(
        client_id=client.id,
        status=NEW_ORDER_STATUS,
        phone=client.phone,
        location=client.location,
        l_t=client.l_t,
        e_t=client.e_t,
        created_at=func.now(),
        updated_at=func.now()
    )
    session.add(order)
    await session.commit()
    return order


async def update_or_create_order_item(session: AsyncSession, order_id, quantity, product_id, price):
    result = await session.execute(select(OrderItem).filter_by(
        order_id=order_id, product_id=product_id
    ))
    order_item = result.scalars().first()
    if order_item:
        order_item.quantity = str(quantity)
        order_item.price = str(price)
        order_item.updated_at = func.now()
        await session.commit()
    else:
        order_item = OrderItem(
            order_id=order_id,
            product_id=product_id,
            quantity=str(quantity),
            price=str(price),
            created_at=func.now(),
            updated_at=func.now()
        )
        session.add(order_item)
        await session.commit()
        return order_item


async def get_order_item(session: AsyncSession, product_id, client_id):
    result = await session.execute(
        select(OrderItem)
        .join(OrderItem.order)
        .options(joinedload(OrderItem.order))
        .filter(
            Order.client_id==client_id,
            Order.status==NEW_ORDER_STATUS,
            OrderItem.product_id==product_id
        )
    )
    return result.scalars().first()


async def get_order_items(session: AsyncSession, client_id):
    result = await session.execute(
        select(OrderItem)
        .join(OrderItem.order)
        .join(OrderItem.product)
        .options(
            joinedload(OrderItem.order),
            joinedload(OrderItem.product)
        )
        .filter(
            Order.client_id == client_id,
            Order.status == NEW_ORDER_STATUS,
        ).order_by(OrderItem.created_at.desc())
    )
    return result.scalars().all()


async def get_order_items_by_order_id(session: AsyncSession, client_id, order_id):
    result = await session.execute(
        select(OrderItem)
        .join(OrderItem.order)
        .join(OrderItem.product)
        .options(
            joinedload(OrderItem.order),
            joinedload(OrderItem.product)
        )
        .filter(
            Order.client_id == int(client_id),
            OrderItem.order_id == int(order_id),
        ).order_by(OrderItem.created_at.desc())
    )
    return result.scalars().all()


async def get_order(session: AsyncSession, client_id):
    result = await session.execute(select(Order).filter_by(client_id=client_id, status=NEW_ORDER_STATUS))
    return result.scalars().first()


async def get_order_by_id_exclude_new(session: AsyncSession, client_id, order_id):
    result = await session.execute(
        select(Order)
        .filter(Order.client_id==client_id, Order.status!=NEW_ORDER_STATUS, Order.id == int(order_id))
    )
    return result.scalars().first()


async def mass_delete_order_items(session: AsyncSession, order_id):
    await session.execute(
        delete(OrderItem).where(OrderItem.order_id == order_id)  # ✅ Deletes all order items at once
    )
    await session.commit()


async def get_orders(session: AsyncSession, client_id):
    result = await session.execute(
        select(Order)
        .join(Order.client)
        .options(
            joinedload(Order.client)
        )
        .filter(
            Order.client_id == client_id,
        ).order_by(Order.created_at.desc())
    )
    return result.scalars().all()


async def get_ordered_orders(session: AsyncSession, client_id):
    result = await session.execute(
        select(Order)
        .join(Order.client)
        .options(
            joinedload(Order.client)
        )
        .filter(
            Order.client_id == client_id, Order.status != NEW_ORDER_STATUS
        ).order_by(Order.created_at.desc())
    )
    return result.scalars().all()

