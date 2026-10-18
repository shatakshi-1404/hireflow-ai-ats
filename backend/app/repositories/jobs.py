import uuid
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Application, Job
from app.models.enums import ApplicationStage, JobStatus
from app.repositories.utils import like_pattern


def get(db: Session, workspace_id: uuid.UUID, job_id: uuid.UUID) -> Job | None:
    return db.scalar(select(Job).where(Job.id == job_id, Job.workspace_id == workspace_id))


def applicant_count(db: Session, job_id: uuid.UUID) -> int:
    return (
        db.scalar(select(func.count()).select_from(Application).where(Application.job_id == job_id))
        or 0
    )


def stage_counts(db: Session, workspace_id: uuid.UUID, job_id: uuid.UUID) -> dict[str, int]:
    counts = {s.value: 0 for s in ApplicationStage}
    rows = db.execute(
        select(Application.stage, func.count())
        .where(Application.workspace_id == workspace_id, Application.job_id == job_id)
        .group_by(Application.stage)
    ).all()
    for stage, n in rows:
        counts[stage.value] = n
    return counts


def list_page(
    db: Session,
    workspace_id: uuid.UUID,
    *,
    q: str | None = None,
    status: JobStatus | None = None,
    department: str | None = None,
    sort: Literal["created_at", "title"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[tuple[Job, int]], int]:
    conds = [Job.workspace_id == workspace_id]
    if status:
        conds.append(Job.status == status)
    if department:
        conds.append(Job.department == department)
    if q and q.strip():
        pattern = like_pattern(q)
        conds.append(
            or_(
                Job.title.ilike(pattern, escape="\\"),
                Job.location.ilike(pattern, escape="\\"),
                Job.department.ilike(pattern, escape="\\"),
            )
        )
    column = Job.created_at if sort == "created_at" else Job.title
    ordering = column.asc() if order == "asc" else column.desc()

    total = db.scalar(select(func.count()).select_from(Job).where(*conds)) or 0
    rows = db.execute(
        select(Job, func.count(Application.id))
        .outerjoin(Application, Application.job_id == Job.id)
        .where(*conds)
        .group_by(Job.id)
        .order_by(ordering, Job.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return [(job, n) for job, n in rows], total
