import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import (
    ApplicationStage,
    InterviewStatus,
    InterviewType,
    pg_enum,
)
from app.models.mixins import CreatedAtMixin, TimestampMixin, UUIDPKMixin


class Application(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("candidate_id", "job_id", name="uq_applications_candidate_job"),
        Index("ix_applications_workspace_stage", "workspace_id", "stage"),
        Index("ix_applications_workspace_applied", "workspace_id", "applied_at"),
        Index("ix_applications_job_stage", "job_id", "stage"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("jobs.id", ondelete="RESTRICT"), nullable=False
    )
    stage: Mapped[ApplicationStage] = mapped_column(
        pg_enum(ApplicationStage), nullable=False, default=ApplicationStage.APPLIED
    )
    applied_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    stage_changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Latest cached match score (0-100). Source of truth is the AIAnalysis row.
    match_score: Mapped[float | None] = mapped_column(Numeric(5, 2))

    candidate: Mapped["Candidate"] = relationship(back_populates="applications")  # noqa: F821
    job: Mapped["Job"] = relationship(back_populates="applications")  # noqa: F821
    history: Mapped[list["StageHistory"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="StageHistory.created_at",
    )
    interviews: Mapped[list["Interview"]] = relationship(
        back_populates="application", cascade="all, delete-orphan", passive_deletes=True
    )


class StageHistory(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "stage_history"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_stage: Mapped[ApplicationStage | None] = mapped_column(pg_enum(ApplicationStage))
    to_stage: Mapped[ApplicationStage] = mapped_column(pg_enum(ApplicationStage), nullable=False)
    changed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    reason: Mapped[str | None] = mapped_column(Text)

    application: Mapped["Application"] = relationship(back_populates="history")


class Interview(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "interviews"
    __table_args__ = (
        CheckConstraint("duration_minutes > 0", name="ck_interviews_duration_positive"),
        Index("ix_interviews_workspace_scheduled", "workspace_id", "scheduled_at"),
    )

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True
    )
    interviewer_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    interviewer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    interview_type: Mapped[InterviewType] = mapped_column(
        pg_enum(InterviewType), nullable=False, default=InterviewType.TECHNICAL
    )
    status: Mapped[InterviewStatus] = mapped_column(
        pg_enum(InterviewStatus), nullable=False, default=InterviewStatus.SCHEDULED
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=45)
    meeting_link: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)

    application: Mapped["Application"] = relationship(back_populates="interviews")
