import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.core.errors import require
from app.core.permissions import CurrentUser, WriterUser
from app.db.session import DbSession
from app.models.enums import ApplicationStage
from app.repositories import applications as repo
from app.schemas.application import (
    ApplicationCreate,
    ApplicationOut,
    StageChange,
    StageHistoryOut,
    application_out,
)
from app.schemas.common import Page, make_page
from app.services import application_service

router = APIRouter(prefix="/applications", tags=["applications"])


@router.get("", response_model=Page[ApplicationOut])
def list_applications(
    user: CurrentUser,
    db: DbSession,
    stage: ApplicationStage | None = None,
    job_id: uuid.UUID | None = None,
    candidate_id: uuid.UUID | None = None,
    active_only: bool = False,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: Literal["applied_at", "stage_changed_at", "candidate_name"] = "applied_at",
    order: Literal["asc", "desc"] = "desc",
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
):
    rows, total = repo.list_page(
        db,
        user.workspace_id,
        stage=stage,
        job_id=job_id,
        candidate_id=candidate_id,
        active_only=active_only,
        q=q,
        sort=sort,
        order=order,
        page=page,
        page_size=page_size,
    )
    return make_page([application_out(a) for a in rows], total, page, page_size)


@router.post("", response_model=ApplicationOut, status_code=201)
def create_application(user: WriterUser, db: DbSession, payload: ApplicationCreate):
    app_ = application_service.create_application(db, user, payload.candidate_id, payload.job_id)
    return application_out(app_)


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(application_id: uuid.UUID, user: CurrentUser, db: DbSession):
    return application_out(require(repo.get_full(db, user.workspace_id, application_id), "Application"))


@router.patch("/{application_id}/stage", response_model=ApplicationOut)
def change_stage(application_id: uuid.UUID, user: WriterUser, db: DbSession, payload: StageChange):
    app_ = application_service.change_stage(db, user, application_id, payload.to_stage, payload.reason)
    return application_out(app_)


@router.get("/{application_id}/history", response_model=list[StageHistoryOut])
def application_history(application_id: uuid.UUID, user: CurrentUser, db: DbSession):
    require(repo.get(db, user.workspace_id, application_id), "Application")
    return [
        StageHistoryOut(
            id=h.id,
            from_stage=h.from_stage,
            to_stage=h.to_stage,
            changed_by_name=name,
            reason=h.reason,
            created_at=h.created_at,
        )
        for h, name in repo.history(db, user.workspace_id, application_id)
    ]
