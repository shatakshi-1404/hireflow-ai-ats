import uuid
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Application, Candidate, Interview, Job
from app.models.enums import InterviewStatus


def _base():
    return (
        select(Interview, Application.candidate_id, Candidate.full_name, Job.title)
        .join(Application, Application.id == Interview.application_id)
        .join(Candidate, Candidate.id == Application.candidate_id)
        .join(Job, Job.id == Application.job_id)
    )


def get(db: Session, workspace_id: uuid.UUID, interview_id: uuid.UUID) -> Any | None:
    return db.execute(
        _base().where(Interview.id == interview_id, Interview.workspace_id == workspace_id)
    ).one_or_none()


def get_for_update(
    db: Session, workspace_id: uuid.UUID, interview_id: uuid.UUID
) -> Interview | None:
    return db.scalar(
        select(Interview)
        .where(Interview.id == interview_id, Interview.workspace_id == workspace_id)
        .with_for_update()
    )


def list_page(
    db: Session,
    workspace_id: uuid.UUID,
    *,
    application_id: uuid.UUID | None = None,
    candidate_id: uuid.UUID | None = None,
    status: InterviewStatus | None = None,
    upcoming_after: datetime | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    order: Literal["asc", "desc"] = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Any], int]:
    conds = [Interview.workspace_id == workspace_id]
    if application_id:
        conds.append(Interview.application_id == application_id)
    if candidate_id:
        conds.append(Application.candidate_id == candidate_id)
    if status:
        conds.append(Interview.status == status)
    if upcoming_after:
        conds += [
            Interview.status == InterviewStatus.SCHEDULED,
            Interview.scheduled_at >= upcoming_after,
        ]
    if start:
        conds.append(Interview.scheduled_at >= start)
    if end:
        conds.append(Interview.scheduled_at < end)

    ordering = Interview.scheduled_at.asc() if order == "asc" else Interview.scheduled_at.desc()
    total = (
        db.scalar(
            select(func.count())
            .select_from(Interview)
            .join(Application, Application.id == Interview.application_id)
            .where(*conds)
        )
        or 0
    )
    rows = db.execute(
        _base()
        .where(*conds)
        .order_by(ordering, Interview.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return list(rows), total
