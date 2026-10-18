import uuid
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, contains_eager, joinedload

from app.core.workflow import ACTIVE_STAGES
from app.models import Application, Candidate, Job, StageHistory, User
from app.models.enums import ApplicationStage
from app.repositories.utils import like_pattern


def get(
    db: Session, workspace_id: uuid.UUID, application_id: uuid.UUID, *, lock: bool = False
) -> Application | None:
    stmt = select(Application).where(
        Application.id == application_id, Application.workspace_id == workspace_id
    )
    if lock:
        stmt = stmt.with_for_update()
    return db.scalar(stmt)


def get_full(
    db: Session, workspace_id: uuid.UUID, application_id: uuid.UUID
) -> Application | None:
    return db.scalar(
        select(Application)
        .where(Application.id == application_id, Application.workspace_id == workspace_id)
        .options(joinedload(Application.candidate), joinedload(Application.job))
        .execution_options(populate_existing=True)
    )


def exists_for(db: Session, candidate_id: uuid.UUID, job_id: uuid.UUID) -> bool:
    return (
        db.scalar(
            select(Application.id).where(
                Application.candidate_id == candidate_id, Application.job_id == job_id
            )
        )
        is not None
    )


def list_page(
    db: Session,
    workspace_id: uuid.UUID,
    *,
    stage: ApplicationStage | None = None,
    job_id: uuid.UUID | None = None,
    candidate_id: uuid.UUID | None = None,
    active_only: bool = False,
    q: str | None = None,
    sort: Literal["applied_at", "stage_changed_at", "candidate_name"] = "applied_at",
    order: Literal["asc", "desc"] = "desc",
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[Application], int]:
    conds = [Application.workspace_id == workspace_id]
    if stage:
        conds.append(Application.stage == stage)
    if job_id:
        conds.append(Application.job_id == job_id)
    if candidate_id:
        conds.append(Application.candidate_id == candidate_id)
    if active_only:
        conds.append(Application.stage.in_(ACTIVE_STAGES))
    if q and q.strip():
        conds.append(Candidate.full_name.ilike(like_pattern(q), escape="\\"))

    columns = {
        "applied_at": Application.applied_at,
        "stage_changed_at": Application.stage_changed_at,
        "candidate_name": Candidate.full_name,
    }
    ordering = columns[sort].asc() if order == "asc" else columns[sort].desc()

    total = (
        db.scalar(
            select(func.count())
            .select_from(Application)
            .join(Application.candidate)
            .where(*conds)
        )
        or 0
    )
    rows = db.scalars(
        select(Application)
        .join(Application.candidate)
        .join(Application.job)
        .options(contains_eager(Application.candidate), contains_eager(Application.job))
        .where(*conds)
        .order_by(ordering, Application.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return list(rows), total


def history(
    db: Session, workspace_id: uuid.UUID, application_id: uuid.UUID
) -> list[tuple[StageHistory, str | None]]:
    rows = db.execute(
        select(StageHistory, User.full_name)
        .outerjoin(User, User.id == StageHistory.changed_by_id)
        .where(
            StageHistory.workspace_id == workspace_id,
            StageHistory.application_id == application_id,
        )
        .order_by(StageHistory.created_at, StageHistory.id)
    ).all()
    return [(h, name) for h, name in rows]


__all__ = ["Job"]  # Job re-exported for convenience in services
