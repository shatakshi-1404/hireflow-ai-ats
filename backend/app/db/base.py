from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base. Models are imported in app/models/__init__.py
    so Alembic can discover them."""
