import uuid

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import AIAnalysisKind, pg_enum
from app.models.mixins import CreatedAtMixin, UUIDPKMixin


class ActivityLog(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "activity_logs"
    __table_args__ = (Index("ix_activity_workspace_created", "workspace_id", "created_at"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    # e.g. "candidate.created", "application.stage_changed"
    action: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    # Optional links so the candidate profile can show its own timeline cheaply.
    candidate_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("candidates.id", ondelete="CASCADE"), index=True
    )
    # "metadata" is reserved by SQLAlchemy's declarative base, so the attribute is `details`.
    details: Mapped[dict | None] = mapped_column("metadata", JSONB)


class AIAnalysis(UUIDPKMixin, CreatedAtMixin, Base):
    __tablename__ = "ai_analyses"
    __table_args__ = (Index("ix_ai_candidate_kind", "candidate_id", "kind"),)

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("jobs.id", ondelete="SET NULL")
    )
    kind: Mapped[AIAnalysisKind] = mapped_column(pg_enum(AIAnalysisKind), nullable=False)
    # "deterministic" or the LLM provider name, so results are never passed off as model output.
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    model: Mapped[str | None] = mapped_column(String(80))
    result: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # Resume analyses stay unconfirmed until the recruiter reviews/corrects them.
    is_confirmed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    error: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
