import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import CreatedAtMixin, TimestampMixin, UUIDPKMixin


class Candidate(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "candidates"
    __table_args__ = (
        UniqueConstraint("workspace_id", "email", name="uq_candidates_workspace_email"),
        Index("ix_candidates_workspace_created", "workspace_id", "created_at"),
        Index("ix_candidates_skills_gin", "skills", postgresql_using="gin"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)  # stored lowercased by service
    phone: Mapped[str | None] = mapped_column(String(32))
    current_title: Mapped[str | None] = mapped_column(String(120))
    skills: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, default=list, server_default="{}"
    )
    years_experience: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    experience_summary: Mapped[str | None] = mapped_column(Text)
    education: Mapped[list[dict] | None] = mapped_column(JSONB)
    source: Mapped[str | None] = mapped_column(String(60))

    resume_filename: Mapped[str | None] = mapped_column(String(255))
    resume_storage_key: Mapped[str | None] = mapped_column(String(255))
    resume_text: Mapped[str | None] = mapped_column(Text)

    is_archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )

    applications: Mapped[list["Application"]] = relationship(  # noqa: F821
        back_populates="candidate", cascade="all, delete-orphan", passive_deletes=True
    )
    notes: Mapped[list["CandidateNote"]] = relationship(
        back_populates="candidate", cascade="all, delete-orphan", passive_deletes=True
    )


class CandidateNote(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "candidate_notes"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)

    candidate: Mapped["Candidate"] = relationship(back_populates="notes")
