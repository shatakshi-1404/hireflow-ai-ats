from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class Workspace(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(120), nullable=False)

    users: Mapped[list["User"]] = relationship(  # noqa: F821
        back_populates="workspace", cascade="all, delete-orphan", passive_deletes=True
    )
