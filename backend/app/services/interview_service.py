import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, UnprocessableError, require
from app.core.workflow import ACTIVE_STAGES
from app.models import Application, Interview, User
from app.models.enums import InterviewStatus
from app.repositories import applications as app_repo
from app.repositories import interviews as repo
from app.schemas.interview import InterviewCreate, InterviewUpdate
from app.services.activity import log_activity
from app.services.utils import reject_nulls

REQUIRED = ("interviewer_name", "interview_type", "status", "scheduled_at", "duration_minutes")


def _check_interviewer(db: Session, workspace_id: uuid.UUID, interviewer_id: uuid.UUID | None):
    if interviewer_id is None:
        return
    require(
        db.scalar(
            select(User.id).where(
                User.id == interviewer_id,
                User.workspace_id == workspace_id,
                User.is_active.is_(True),
            )
        ),
        "Interviewer",
    )


def create_interview(db: Session, user: User, data: InterviewCreate) -> Any:
    ws = user.workspace_id
    application = require(app_repo.get(db, ws, data.application_id), "Application")
    if application.stage not in ACTIVE_STAGES:
        raise UnprocessableError("Interviews can only be scheduled for active applications")
    if data.scheduled_at <= datetime.now(UTC):
        raise UnprocessableError("Interview must be scheduled in the future")
    _check_interviewer(db, ws, data.interviewer_id)

    interview = Interview(workspace_id=ws, **data.model_dump())
    db.add(interview)
    db.flush()
    log_activity(
        db,
        workspace_id=ws,
        actor_id=user.id,
        action="interview.scheduled",
        entity_type="interview",
        entity_id=interview.id,
        candidate_id=application.candidate_id,
        details={"scheduled_at": data.scheduled_at.isoformat(), "type": data.interview_type.value},
    )
    db.commit()
    return require(repo.get(db, ws, interview.id), "Interview")


def update_interview(
    db: Session, user: User, interview_id: uuid.UUID, data: InterviewUpdate
) -> Any:
    ws = user.workspace_id
    interview = require(repo.get_for_update(db, ws, interview_id), "Interview")
    changes = data.model_dump(exclude_unset=True)
    reject_nulls(changes, REQUIRED)

    if interview.status != InterviewStatus.SCHEDULED and set(changes) - {"notes"}:
        raise ConflictError("Only notes can be edited once an interview is no longer scheduled")

    now = datetime.now(UTC)
    status_change: InterviewStatus | None = None
    if "status" in changes:
        new_status = changes.pop("status")
        if new_status != interview.status:
            status_change = new_status

    if "scheduled_at" in changes and changes["scheduled_at"] <= now:
        raise UnprocessableError("Rescheduled time must be in the future")
    effective_time = changes.get("scheduled_at", interview.scheduled_at)
    if (
        status_change in (InterviewStatus.COMPLETED, InterviewStatus.NO_SHOW)
        and effective_time > now
    ):
        raise UnprocessableError("A future interview cannot be marked completed or no-show")
    if "interviewer_id" in changes:
        _check_interviewer(db, ws, changes["interviewer_id"])

    for key, value in changes.items():
        setattr(interview, key, value)
    if status_change:
        interview.status = status_change

    if status_change:
        action = "interview.status_changed"
    elif "scheduled_at" in changes:
        action = "interview.rescheduled"
    else:
        action = "interview.updated"
    application = db.get(Application, interview.application_id)
    details: dict[str, Any] = {"fields": sorted(changes)}
    if status_change:
        details["status"] = status_change.value
    log_activity(
        db,
        workspace_id=ws,
        actor_id=user.id,
        action=action,
        entity_type="interview",
        entity_id=interview.id,
        candidate_id=application.candidate_id if application else None,
        details=details,
    )
    db.commit()
    return require(repo.get(db, ws, interview.id), "Interview")
