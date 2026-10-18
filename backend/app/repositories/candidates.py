import uuid
from typing import Literal

from sqlalchemy import any_, func, literal, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import ActivityLog, Application, Candidate, CandidateNote, User
from app.models.enums import ApplicationStage
from app.repositories.utils import like_pattern

SORT_COLUMNS = {
    "created_at": Candidate.created_at,
    "full_name": Candidate.full_name,
    "years_experience": Candidate.years_experience,
}


def get(db: Session, workspace_id: uuid.UUID, candidate_id: uuid.UUID) -> Candidate | None:
    return db.scalar(
        select(Candidate).where(
            Candidate.id == candidate_id, Candidate.workspace_id == workspace_id
        )
    )


def get_with_applications(
    db: Session, workspace_id: uuid.UUID, candidate_id: uuid.UUID
) -> Candidate | None:
    return db.scalar(
        select(Candidate)
        .where(Candidate.id == candidate_id, Candidate.workspace_id == workspace_id)
        .options(selectinload(Candidate.applications).joinedload(Application.job))
    )


def get_by_email(db: Session, workspace_id: uuid.UUID, email: str) -> Candidate | None:
    return db.scalar(
        select(Candidate).where(Candidate.workspace_id == workspace_id, Candidate.email == email)
    )


def count_applications(db: Session, candidate_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count()).select_from(Application).where(
                Application.candidate_id == candidate_id
            )
        )
        or 0
    )


def list_page(
    db: Session,
    workspace_id: uuid.UUID,
    *,
    q: str | None = None,
    skills: list[str] | None = None,
    stage: ApplicationStage | None = None,
    job_id: uuid.UUID | None = None,
    min_experience: float | None = None,
    max_experience: float | None = None,
    include_archived: bool = False,
    sort: Literal["created_at", "full_name", "years_experience"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Candidate], int]:
    conds = [Candidate.workspace_id == workspace_id]
    if not include_archived:
        conds.append(Candidate.is_archived.is_(False))
    if q and q.strip():
        pattern = like_pattern(q)
        conds.append(
            or_(
                Candidate.full_name.ilike(pattern, escape="\\"),
                Candidate.email.ilike(pattern, escape="\\"),
                Candidate.current_title.ilike(pattern, escape="\\"),
                literal(q.strip().lower()) == any_(Candidate.skills),
            )
        )
    if skills:
        conds.append(Candidate.skills.contains(skills))  # has ALL listed skills
    if min_experience is not None:
        conds.append(Candidate.years_experience >= min_experience)
    if max_experience is not None:
        conds.append(Candidate.years_experience <= max_experience)
    if stage or job_id:
        sub = select(Application.candidate_id).where(Application.workspace_id == workspace_id)
        if stage:
            sub = sub.where(Application.stage == stage)
        if job_id:
            sub = sub.where(Application.job_id == job_id)
        conds.append(Candidate.id.in_(sub))

    column = SORT_COLUMNS[sort]
    ordering = column.asc() if order == "asc" else column.desc()
    if sort == "years_experience":
        ordering = ordering.nulls_last()

    total = db.scalar(select(func.count()).select_from(Candidate).where(*conds)) or 0
    rows = db.scalars(
        select(Candidate)
        .where(*conds)
        .order_by(ordering, Candidate.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return list(rows), total


def list_notes(
    db: Session, workspace_id: uuid.UUID, candidate_id: uuid.UUID
) -> list[tuple[CandidateNote, str | None]]:
    rows = db.execute(
        select(CandidateNote, User.full_name)
        .outerjoin(User, User.id == CandidateNote.author_id)
        .where(
            CandidateNote.workspace_id == workspace_id,
            CandidateNote.candidate_id == candidate_id,
        )
        .order_by(CandidateNote.created_at.desc())
    ).all()
    return [(n, name) for n, name in rows]


def list_activity(
    db: Session, workspace_id: uuid.UUID, candidate_id: uuid.UUID, limit: int = 100
) -> list[tuple[ActivityLog, str | None]]:
    rows = db.execute(
        select(ActivityLog, User.full_name)
        .outerjoin(User, User.id == ActivityLog.actor_id)
        .where(
            ActivityLog.workspace_id == workspace_id,
            ActivityLog.candidate_id == candidate_id,
        )
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    ).all()
    return [(a, name) for a, name in rows]
