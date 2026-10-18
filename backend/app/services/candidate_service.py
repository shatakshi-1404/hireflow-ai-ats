import uuid

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, require
from app.core.storage import get_storage
from app.models import Candidate, CandidateNote, User
from app.repositories import ai as ai_repo
from app.repositories import candidates as repo
from app.schemas.candidate import CandidateCreate, CandidateUpdate
from app.services.activity import log_activity
from app.services.utils import reject_nulls

DUPLICATE = "A candidate with this email already exists in this workspace"
REQUIRED = ("full_name", "email", "skills", "is_archived")


def create_candidate(db: Session, user: User, data: CandidateCreate) -> Candidate:
    email = str(data.email).lower()
    if repo.get_by_email(db, user.workspace_id, email):
        raise ConflictError(DUPLICATE)
    candidate = Candidate(
        workspace_id=user.workspace_id,
        created_by_id=user.id,
        email=email,
        **data.model_dump(exclude={"email"}),
    )
    db.add(candidate)
    db.flush()
    log_activity(
        db,
        workspace_id=user.workspace_id,
        actor_id=user.id,
        action="candidate.created",
        entity_type="candidate",
        entity_id=candidate.id,
        candidate_id=candidate.id,
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError(DUPLICATE) from None
    return candidate


def update_candidate(
    db: Session, user: User, candidate_id: uuid.UUID, data: CandidateUpdate
) -> Candidate:
    candidate = require(repo.get(db, user.workspace_id, candidate_id), "Candidate")
    changes = data.model_dump(exclude_unset=True)
    reject_nulls(changes, REQUIRED)
    if "email" in changes:
        changes["email"] = str(changes["email"]).lower()
        other = repo.get_by_email(db, user.workspace_id, changes["email"])
        if other and other.id != candidate.id:
            raise ConflictError(DUPLICATE)
    for key, value in changes.items():
        setattr(candidate, key, value)
    log_activity(
        db,
        workspace_id=user.workspace_id,
        actor_id=user.id,
        action="candidate.updated",
        entity_type="candidate",
        entity_id=candidate.id,
        candidate_id=candidate.id,
        details={"fields": sorted(changes)},
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError(DUPLICATE) from None
    return candidate


def delete_candidate(db: Session, user: User, candidate_id: uuid.UUID) -> None:
    candidate = require(repo.get(db, user.workspace_id, candidate_id), "Candidate")
    if repo.count_applications(db, candidate.id) > 0:
        raise ConflictError(
            "This candidate has applications and cannot be deleted. Archive them instead."
        )
    keys = set(ai_repo.resume_file_keys(db, user.workspace_id, candidate.id))
    if candidate.resume_storage_key:
        keys.add(candidate.resume_storage_key)
    db.delete(candidate)
    log_activity(
        db,
        workspace_id=user.workspace_id,
        actor_id=user.id,
        action="candidate.deleted",
        entity_type="candidate",
        entity_id=candidate_id,
    )
    db.commit()
    for key in keys:  # only after the commit succeeded
        get_storage().delete(key)


def add_note(db: Session, user: User, candidate_id: uuid.UUID, body: str) -> CandidateNote:
    candidate = require(repo.get(db, user.workspace_id, candidate_id), "Candidate")
    note = CandidateNote(
        workspace_id=user.workspace_id, candidate_id=candidate.id, author_id=user.id, body=body
    )
    db.add(note)
    db.flush()
    log_activity(
        db,
        workspace_id=user.workspace_id,
        actor_id=user.id,
        action="candidate.note_added",
        entity_type="candidate",
        entity_id=candidate.id,
        candidate_id=candidate.id,
    )
    db.commit()
    return note
