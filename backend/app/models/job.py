import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    Uuid,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import EmploymentType, JobStatus, pg_enum
from app.models.mixins import TimestampMixin, UUIDPKMixin


class Job(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint(
            "max_experience IS NULL OR min_experience IS NULL OR max_experience >= min_experience",
            name="ck_jobs_experience_range",
        ),
        Index("ix_jobs_workspace_status", "workspace_id", "status"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    department: Mapped[str | None] = mapped_column(String(80))
    location: Mapped[str | None] = mapped_column(String(120))
    employment_type: Mapped[EmploymentType] = mapped_column(
        pg_enum(EmploymentType), nullable=False, default=EmploymentType.FULL_TIME
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    required_skills: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default="{}"
    )
    preferred_skills: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default="{}"
    )
    min_experience: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    max_experience: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    status: Mapped[JobStatus] = mapped_column(
        pg_enum(JobStatus), nullable=False, default=JobStatus.OPEN
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )

    applications: Mapped[list["Application"]] = relationship(  # noqa: F821
        back_populates="job", passive_deletes=True
    )
