import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response, UploadFile

from app.core.errors import NotFoundError, PayloadTooLargeError, require
from app.core.storage import get_storage
from app.core.permissions import CurrentUser, WriterUser
from app.db.session import DbSession
from app.models.enums import ApplicationStage
from app.repositories import candidates as repo
from app.schemas.application import application_brief
from app.schemas.candidate import (
    ActivityOut,
    CandidateCreate,
    CandidateDetailOut,
    CandidateOut,
    CandidateUpdate,
    NoteCreate,
    NoteOut,
)
from app.schemas.common import Page, make_page, normalize_skills
from app.schemas.imports import ImportResult
from app.services import candidate_service, import_service

router = APIRouter(prefix="/candidates", tags=["candidates"])

MAX_IMPORT_BYTES = 1_000_000


@router.get("", response_model=Page[CandidateOut])
def list_candidates(
    user: CurrentUser,
    db: DbSession,
    q: Annotated[str | None, Query(max_length=100)] = None,
    skills: Annotated[list[str] | None, Query(max_length=20)] = None,
    stage: ApplicationStage | None = None,
    job_id: uuid.UUID | None = None,
    min_experience: Annotated[float | None, Query(ge=0, le=60)] = None,
    max_experience: Annotated[float | None, Query(ge=0, le=60)] = None,
    include_archived: bool = False,
    sort: Literal["created_at", "full_name", "years_experience"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    clean_skills = normalize_skills([s[:60] for s in skills]) if skills else None
    rows, total = repo.list_page(
        db,
        user.workspace_id,
        q=q,
        skills=clean_skills,
        stage=stage,
        job_id=job_id,
        min_experience=min_experience,
        max_experience=max_experience,
        include_archived=include_archived,
        sort=sort,
        order=order,
        page=page,
        page_size=page_size,
    )
    return make_page([CandidateOut.model_validate(c) for c in rows], total, page, page_size)


@router.post("", response_model=CandidateOut, status_code=201)
def create_candidate(user: WriterUser, db: DbSession, payload: CandidateCreate):
    return candidate_service.create_candidate(db, user, payload)


@router.post("/import", response_model=ImportResult)
def import_candidates(user: WriterUser, db: DbSession, file: UploadFile, dry_run: bool = False):
    raw = file.file.read(MAX_IMPORT_BYTES + 1)
    if len(raw) > MAX_IMPORT_BYTES:
        raise PayloadTooLargeError("CSV must be 1 MB or smaller")
    return import_service.import_candidates(db, user, raw, dry_run)


@router.get("/{candidate_id}", response_model=CandidateDetailOut)
def get_candidate(candidate_id: uuid.UUID, user: CurrentUser, db: DbSession):
    c = require(repo.get_with_applications(db, user.workspace_id, candidate_id), "Candidate")
    apps = sorted(c.applications, key=lambda a: a.applied_at, reverse=True)
    return CandidateDetailOut(
        **CandidateOut.model_validate(c).model_dump(),
        applications=[application_brief(a) for a in apps],
    )


@router.get("/{candidate_id}/resume")
def download_resume(candidate_id: uuid.UUID, user: CurrentUser, db: DbSession) -> Response:
    c = require(repo.get(db, user.workspace_id, candidate_id), "Candidate")
    if not c.resume_storage_key:
        raise NotFoundError("No resume on file")
    try:
        data = get_storage().read(c.resume_storage_key)
    except FileNotFoundError:
        raise NotFoundError("The resume file is no longer available") from None
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{c.resume_filename or "resume.pdf"}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.patch("/{candidate_id}", response_model=CandidateOut)
def update_candidate(
    candidate_id: uuid.UUID, user: WriterUser, db: DbSession, payload: CandidateUpdate
):
    return candidate_service.update_candidate(db, user, candidate_id, payload)


@router.delete("/{candidate_id}", status_code=204)
def delete_candidate(candidate_id: uuid.UUID, user: WriterUser, db: DbSession) -> Response:
    candidate_service.delete_candidate(db, user, candidate_id)
    return Response(status_code=204)


@router.get("/{candidate_id}/notes", response_model=list[NoteOut])
def list_notes(candidate_id: uuid.UUID, user: CurrentUser, db: DbSession):
    require(repo.get(db, user.workspace_id, candidate_id), "Candidate")
    return [
        NoteOut(id=n.id, author_name=name, body=n.body, created_at=n.created_at)
        for n, name in repo.list_notes(db, user.workspace_id, candidate_id)
    ]


@router.post("/{candidate_id}/notes", response_model=NoteOut, status_code=201)
def add_note(candidate_id: uuid.UUID, user: WriterUser, db: DbSession, payload: NoteCreate):
    note = candidate_service.add_note(db, user, candidate_id, payload.body)
    return NoteOut(
        id=note.id, author_name=user.full_name, body=note.body, created_at=note.created_at
    )


@router.get("/{candidate_id}/activity", response_model=list[ActivityOut])
def candidate_activity(candidate_id: uuid.UUID, user: CurrentUser, db: DbSession):
    require(repo.get(db, user.workspace_id, candidate_id), "Candidate")
    return [
        ActivityOut(
            id=a.id,
            action=a.action,
            entity_type=a.entity_type,
            actor_name=name,
            details=a.details,
            created_at=a.created_at,
        )
        for a, name in repo.list_activity(db, user.workspace_id, candidate_id)
    ]
