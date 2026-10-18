import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import UnprocessableError, require
from app.models import Job, User
from app.models.enums import JobStatus
from app.repositories import jobs as repo
from app.schemas.job import JobCreate, JobUpdate
from app.services.activity import log_activity
from app.services.utils import reject_nulls

REQUIRED = (
    "title",
    "description",
    "employment_type",
    "status",
    "required_skills",
    "preferred_skills",
)


def create_job(db: Session, user: User, data: JobCreate) -> Job:
    job = Job(workspace_id=user.workspace_id, created_by_id=user.id, **data.model_dump())
    if job.status == JobStatus.CLOSED:
        job.closed_at = datetime.now(UTC)
    db.add(job)
    db.flush()
    log_activity(
        db,
        workspace_id=user.workspace_id,
        actor_id=user.id,
        action="job.created",
        entity_type="job",
        entity_id=job.id,
        details={"title": job.title},
    )
    db.commit()
    return job


def update_job(db: Session, user: User, job_id: uuid.UUID, data: JobUpdate) -> Job:
    job = require(repo.get(db, user.workspace_id, job_id), "Job")
    changes = data.model_dump(exclude_unset=True)
    reject_nulls(changes, REQUIRED)

    new_min = changes.get("min_experience", job.min_experience)
    new_max = changes.get("max_experience", job.max_experience)
    if new_min is not None and new_max is not None and new_max < new_min:
        raise UnprocessableError("max_experience must be greater than or equal to min_experience")

    action = "job.updated"
    if "status" in changes and changes["status"] != job.status:
        closing = changes["status"] == JobStatus.CLOSED
        job.closed_at = datetime.now(UTC) if closing else None
        action = "job.closed" if closing else "job.status_changed"
    for key, value in changes.items():
        setattr(job, key, value)
    log_activity(
        db,
        workspace_id=user.workspace_id,
        actor_id=user.id,
        action=action,
        entity_type="job",
        entity_id=job.id,
        details={"title": job.title, "fields": sorted(changes)},
    )
    db.commit()
    return job
