import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import func, literal_column, select
from sqlalchemy.orm import Session

from app.core.workflow import ACTIVE_STAGES
from app.models import ActivityLog, Application, Candidate, Interview, Job, StageHistory, User
from app.models.enums import ApplicationStage, InterviewStatus, JobStatus

GRANULARITIES = {"day", "week", "month"}


def _cohort(workspace_id: uuid.UUID, start: datetime | None, end: datetime | None) -> list[Any]:
    conds: list[Any] = [Application.workspace_id == workspace_id]
    if start:
        conds.append(Application.applied_at >= start)
    if end:
        conds.append(Application.applied_at < end)
    return conds


def kpis(db: Session, workspace_id: uuid.UUID, now: datetime) -> dict[str, int]:
    total_candidates = (
        db.scalar(
            select(func.count())
            .select_from(Candidate)
            .where(Candidate.workspace_id == workspace_id, Candidate.is_archived.is_(False))
        )
        or 0
    )
    active_jobs = (
        db.scalar(
            select(func.count())
            .select_from(Job)
            .where(Job.workspace_id == workspace_id, Job.status == JobStatus.OPEN)
        )
        or 0
    )
    by_stage = dict(
        db.execute(
            select(Application.stage, func.count())
            .where(Application.workspace_id == workspace_id)
            .group_by(Application.stage)
        ).all()
    )
    upcoming = (
        db.scalar(
            select(func.count())
            .select_from(Interview)
            .where(
                Interview.workspace_id == workspace_id,
                Interview.status == InterviewStatus.SCHEDULED,
                Interview.scheduled_at >= now,
            )
        )
        or 0
    )
    return {
        "total_candidates": total_candidates,
        "active_jobs": active_jobs,
        "active_applications": sum(by_stage.get(s, 0) for s in ACTIVE_STAGES),
        "upcoming_interviews": upcoming,
        "offers": by_stage.get(ApplicationStage.OFFER, 0),
        "hires": by_stage.get(ApplicationStage.HIRED, 0),
    }


def applications_per_bucket(
    db: Session,
    workspace_id: uuid.UUID,
    granularity: str,
    start: datetime,
    end: datetime,
) -> dict[date, int]:
    assert granularity in GRANULARITIES  # inlined as a literal below, so it must be validated
    bucket = func.date_trunc(
        literal_column(f"'{granularity}'"), func.timezone("UTC", Application.applied_at)
    )
    rows = db.execute(
        select(bucket.label("bucket"), func.count())
        .where(*_cohort(workspace_id, start, end))
        .group_by(bucket)
        .order_by(bucket)
    ).all()
    return {r[0].date(): r[1] for r in rows}


def recent_activity(
    db: Session, workspace_id: uuid.UUID, limit: int = 10
) -> list[tuple[ActivityLog, str | None, str | None]]:
    rows = db.execute(
        select(ActivityLog, User.full_name, Candidate.full_name)
        .outerjoin(User, User.id == ActivityLog.actor_id)
        .outerjoin(Candidate, Candidate.id == ActivityLog.candidate_id)
        .where(ActivityLog.workspace_id == workspace_id)
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id)
        .limit(limit)
    ).all()
    return [(a, actor, cand) for a, actor, cand in rows]


def cohort_size(
    db: Session, workspace_id: uuid.UUID, start: datetime | None, end: datetime | None
) -> int:
    return (
        db.scalar(
            select(func.count()).select_from(Application).where(*_cohort(workspace_id, start, end))
        )
        or 0
    )


def stage_distribution(
    db: Session, workspace_id: uuid.UUID, start: datetime | None, end: datetime | None
) -> dict[ApplicationStage, int]:
    return dict(
        db.execute(
            select(Application.stage, func.count())
            .where(*_cohort(workspace_id, start, end))
            .group_by(Application.stage)
        ).all()
    )


def reached_counts(
    db: Session, workspace_id: uuid.UUID, start: datetime | None, end: datetime | None
) -> dict[ApplicationStage, int]:
    return dict(
        db.execute(
            select(StageHistory.to_stage, func.count(func.distinct(StageHistory.application_id)))
            .join(Application, Application.id == StageHistory.application_id)
            .where(StageHistory.workspace_id == workspace_id, *_cohort(workspace_id, start, end))
            .group_by(StageHistory.to_stage)
        ).all()
    )
