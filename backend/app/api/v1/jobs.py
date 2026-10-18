import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.core.errors import require
from app.core.permissions import CurrentUser, WriterUser
from app.db.session import DbSession
from app.models.enums import JobStatus
from app.repositories import jobs as repo
from app.schemas.common import Page, make_page
from app.schemas.job import JobCreate, JobDetailOut, JobOut, JobUpdate
from app.services import job_service

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _job_out(job, count: int) -> JobOut:
    return JobOut.model_validate(job).model_copy(update={"applicant_count": count})


@router.get("", response_model=Page[JobOut])
def list_jobs(
    user: CurrentUser,
    db: DbSession,
    q: Annotated[str | None, Query(max_length=100)] = None,
    status: JobStatus | None = None,
    department: Annotated[str | None, Query(max_length=80)] = None,
    sort: Literal["created_at", "title"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    rows, total = repo.list_page(
        db,
        user.workspace_id,
        q=q,
        status=status,
        department=department,
        sort=sort,
        order=order,
        page=page,
        page_size=page_size,
    )
    return make_page([_job_out(j, n) for j, n in rows], total, page, page_size)


@router.post("", response_model=JobOut, status_code=201)
def create_job(user: WriterUser, db: DbSession, payload: JobCreate):
    return _job_out(job_service.create_job(db, user, payload), 0)


def _detail(db, workspace_id, job) -> JobDetailOut:
    counts = repo.stage_counts(db, workspace_id, job.id)
    return JobDetailOut(
        **JobOut.model_validate(job).model_dump(exclude={"applicant_count"}),
        applicant_count=sum(counts.values()),
        stage_counts=counts,
    )


@router.get("/{job_id}", response_model=JobDetailOut)
def get_job(job_id: uuid.UUID, user: CurrentUser, db: DbSession):
    job = require(repo.get(db, user.workspace_id, job_id), "Job")
    return _detail(db, user.workspace_id, job)


@router.patch("/{job_id}", response_model=JobDetailOut)
def update_job(job_id: uuid.UUID, user: WriterUser, db: DbSession, payload: JobUpdate):
    job = job_service.update_job(db, user, job_id, payload)
    return _detail(db, user.workspace_id, job)
