import uuid
from datetime import UTC, date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.core.dates import to_utc_range
from app.core.errors import require
from app.core.permissions import CurrentUser, WriterUser
from app.db.session import DbSession
from app.models.enums import InterviewStatus
from app.repositories import interviews as repo
from app.schemas.common import Page, make_page
from app.schemas.interview import (
    InterviewCreate,
    InterviewOut,
    InterviewUpdate,
    interview_out,
)
from app.services import interview_service

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.get("", response_model=Page[InterviewOut])
def list_interviews(
    user: CurrentUser,
    db: DbSession,
    application_id: uuid.UUID | None = None,
    candidate_id: uuid.UUID | None = None,
    status: InterviewStatus | None = None,
    upcoming: bool = False,
    date_from: date | None = None,
    date_to: date | None = None,
    order: Literal["asc", "desc"] | None = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    start, end = to_utc_range(date_from, date_to)
    rows, total = repo.list_page(
        db,
        user.workspace_id,
        application_id=application_id,
        candidate_id=candidate_id,
        status=status,
        upcoming_after=datetime.now(UTC) if upcoming else None,
        start=start,
        end=end,
        order=order or ("asc" if upcoming else "desc"),
        page=page,
        page_size=page_size,
    )
    return make_page([interview_out(r) for r in rows], total, page, page_size)


@router.post("", response_model=InterviewOut, status_code=201)
def create_interview(user: WriterUser, db: DbSession, payload: InterviewCreate):
    return interview_out(interview_service.create_interview(db, user, payload))


@router.get("/{interview_id}", response_model=InterviewOut)
def get_interview(interview_id: uuid.UUID, user: CurrentUser, db: DbSession):
    return interview_out(require(repo.get(db, user.workspace_id, interview_id), "Interview"))


@router.patch("/{interview_id}", response_model=InterviewOut)
def update_interview(
    interview_id: uuid.UUID, user: WriterUser, db: DbSession, payload: InterviewUpdate
):
    return interview_out(interview_service.update_interview(db, user, interview_id, payload))
