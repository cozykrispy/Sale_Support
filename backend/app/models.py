from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    JSON,
    ForeignKey,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    status = Column(String(50), default="active", nullable=False, index=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )


class Category(Base):
    """Top-level product taxonomy table (Category is the largest grouping)."""

    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, index=True, nullable=False)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    types = relationship(
        "ProductType",
        back_populates="category_rel",
        cascade="all, delete-orphan",
        order_by="ProductType.id.asc()",
    )
    products = relationship("Product", back_populates="category_rel")


class ProductType(Base):
    """Second-level taxonomy table: Type belongs to a Category."""

    __tablename__ = "product_types"
    __table_args__ = (
        UniqueConstraint("category_id", "name", name="uq_category_type_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), index=True, nullable=False)
    category_id = Column(
        Integer,
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    category_rel = relationship("Category", back_populates="types")
    sub_types = relationship(
        "ProductSubType",
        back_populates="type_rel",
        cascade="all, delete-orphan",
        order_by="ProductSubType.id.asc()",
    )
    products = relationship("Product", back_populates="type_rel")


class ProductSubType(Base):
    """Third-level taxonomy table: Sub Type belongs to a Type."""

    __tablename__ = "product_sub_types"
    __table_args__ = (
        UniqueConstraint("type_id", "name", name="uq_type_subtype_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), index=True, nullable=False)
    type_id = Column(
        Integer,
        ForeignKey("product_types.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    type_rel = relationship("ProductType", back_populates="sub_types")
    products = relationship("Product", back_populates="sub_type_rel")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    brand = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=False)
    image_url = Column(String(500), nullable=False)

    # Relational Foreign Keys to Category -> ProductType -> ProductSubType
    category_id = Column(
        Integer, ForeignKey("categories.id"), nullable=True, index=True
    )
    type_id = Column(
        Integer, ForeignKey("product_types.id"), nullable=True, index=True
    )
    sub_type_id = Column(
        Integer, ForeignKey("product_sub_types.id"), nullable=True, index=True
    )

    # Denormalized names kept in sync for fast querying & backward compatibility
    category = Column(String(150), nullable=False, index=True)
    type = Column(String(150), nullable=False, index=True)
    sub_type = Column(String(150), nullable=False, index=True)

    status = Column(String(50), default="active", nullable=False, index=True)
    supporting_documents = Column(JSON, default=list, nullable=False)
    cross_sell_products = Column(JSON, default=list, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    category_rel = relationship("Category", back_populates="products")
    type_rel = relationship("ProductType", back_populates="products")
    sub_type_rel = relationship("ProductSubType", back_populates="products")


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    query = Column(Text, nullable=False)
    search_mode = Column(String(50), default="quick", nullable=False)
    model_used = Column(String(150), default="Auto (default)", nullable=False)
    results = Column(JSON, nullable=False)
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
