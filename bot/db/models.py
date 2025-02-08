from sqlalchemy import Column, String, DateTime, BigInteger, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.setup import Base


class Client(Base):
    __tablename__ = "app_client"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(100), nullable=True)
    tg_phone = Column(String(100), nullable=True)
    tg_id = Column(String(100), nullable=True, unique=True)
    tg_nick = Column(String(100), nullable=True)
    location = Column(String(255), nullable=True)
    l_t = Column(String(255), nullable=True)
    e_t = Column(String(255), nullable=True)
    lang = Column(String(10), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    orders = relationship("Order", back_populates="client")

    def __repr__(self):
        return f"<Client {self.tg_phone}>"


class Descriptions(Base):  # ✅ Ensure this is defined before Product
    __tablename__ = "app_descriptions"

    id = Column(Integer, primary_key=True, index=True)
    name_uz = Column(String(255), nullable=False)
    name_ru = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    products = relationship("Product", back_populates="measure")


class Product(Base):
    __tablename__ = "app_product"

    id = Column(Integer, primary_key=True, index=True)
    img = Column(String(255), nullable=True)  # Store image URL or file path
    name_uz = Column(String(255), nullable=False)
    name_ru = Column(String(255), nullable=False)
    price = Column(String(255), nullable=False)  # Consider using Decimal for price
    desc_uz = Column(Text, nullable=True)
    desc_ru = Column(Text, nullable=True)

    measure_id = Column(Integer, ForeignKey("app_descriptions.id", ondelete="SET NULL"), nullable=True)
    measure = relationship("Descriptions", back_populates="products")
    order_item_products = relationship("OrderItem", back_populates="product")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Order(Base):
    __tablename__ = "app_order"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("app_client.id", ondelete="DO NOTHING"), nullable=False)
    status = Column(String(100), nullable=False)
    phone = Column(String(100), nullable=True)
    location = Column(String(255), nullable=True)
    l_t = Column(String(255), nullable=True)
    e_t = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    client = relationship("Client", back_populates="orders")  # Establish relation with Client
    order_items = relationship("OrderItem", back_populates="order")  # Establish relation with Client

    def __repr__(self):
        return f"<Order(id={self.id}, status={self.status}, client_id={self.client_id})>"


class OrderItem(Base):
    __tablename__ = "app_orderitem"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("app_order.id", ondelete="DO NOTHING"), nullable=False)
    product_id = Column(Integer, ForeignKey("app_product.id", ondelete="DO NOTHING"), nullable=False)
    quantity = Column(String(50), nullable=True)
    price = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    order = relationship("Order", back_populates="order_items")
    product = relationship("Product", back_populates="order_item_products")

    def __repr__(self):
        return f"<OrderItem(id={self.id}, order_id={self.order_id}, product_id={self.product_id}, quantity={self.quantity})>"