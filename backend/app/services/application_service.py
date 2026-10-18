import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, UnprocessableError, require
from app.core.workflow import REOPEN_FROM, TRANSITIONS, allowed_next
from app.models import Application, Job, StageHistory, User
from app.models.enums import ApplicationStage, JobStatus
from app.repositories import applications as repo
from app.repositories import candidates as candidate_repo
from app.repositories import jobs as job_repo
from app.services.activity import log_activity

DUPLICATE = "This candidate has already applied to this job"


def create_application(
    db: Session, user: User, candidate_id: uuid.UUID, job_id: uuid.UUID
) -> Application:
    ws = user.workspace_id
    # Both lookups are workspace-scoped, so foreign IDs behave like missing ones (404).
    candidate = require(candidate_repo.get(db, ws, candidate_id), "Candidate")
    job = require(job_repo.get(db, ws, job_id), "Job")
    if candidate.is_archived:
        raise UnprocessableError("Archived candidates cannot be added to a job")
    if job.status != JobStatus.OPEN:
        raise UnprocessableError("This job is not open for applications")
    if repo.exists_for(db, candidate.id, job.id):
        raise ConflictError(DUPLICATE)

    application = Application(
        workspace_id=ws, candidate_id=candidate.id, job_id=job.id, stage=ApplicationStage.APPLIED
    )
    db.add(application)
    db.flush()
    db.add(
        StageHistory(
            workspace_id=ws,
            application_id=application.id,
            from_stage=None,
            to_stage=ApplicationStage.APPLIED,
            changed_by_id=user.id,
        )
    )
    log_activity(
        db,
        workspace_id=ws,
        actor_id=user.id,
        action="application.created",
        entity_type="application",
        entity_id=application.id,
        candidate_id=candidate.id,
        details={"job_id": str(job.id), "job_title": job.title},
    )
    try:
        db.commit()
    except IntegrityError:  # concurrent duplicate caught by the unique constraint
        db.rollback()
        raise ConflictError(DUPLICATE) from None
    return require(repo.get_full(db, ws, application.id), "Application")


def change_stage(
    db: Session,
    user: User,
    application_id: uuid.UUID,
    to_stage: ApplicationStage,
    reason: str | None,
) -> Application:
    ws = user.workspace_id
    # Row lock prevents two concurrent moves from both validating against the same stage.
    application = require(repo.get(db, ws, application_id, lock=True), "Application")
    from_stage = application.stage

    if to_stage == from_stage:
        raise ConflictError(f"Application is already in stage {to_stage.value}")
    if to_stage not in TRANSITIONS[from_stage]:
        allowed = ", ".join(s.value for s in allowed_next(from_stage)) or "none"
        raise ConflictError(
            f"Cannot move from {from_stage.value} to {to_stage.value}. Allowed: {allowed}"
        )
    if from_stage in REOPEN_FROM and not (reason and reason.strip()):
        raise UnprocessableError("A reason is required to reopen a closed application")

    job = db.get(Job, application.job_id)
    application.stage = to_stage
    application.stage_changed_at = datetime.now(UTC)
    db.add(
        StageHistory(
            workspace_id=ws,
            application_id=application.id,
            from_stage=from_stage,
            to_stage=to_stage,
            changed_by_id=user.id,
            reason=reason.strip() if reason else None,
        )
    )
    log_activity(
        db,
        workspace_id=ws,
        actor_id=user.id,
        action="application.stage_changed",
        entity_type="application",
        entity_id=application.id,
        candidate_id=application.candidate_id,
        details={
            "from": from_stage.value,
            "to": to_stage.value,
            "job_title": job.title if job else None,
        },
    )
    db.commit()
    return require(repo.get_full(db, ws, application.id), "Application")
