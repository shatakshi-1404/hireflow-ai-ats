import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models import ActivityLog


def log_activity(
    db: Session,
    *,
    workspace_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID | None = None,
    candidate_id: uuid.UUID | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Adds an audit row to the current transaction (caller commits)."""
    db.add(
        ActivityLog(
            workspace_id=workspace_id,
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            candidate_id=candidate_id,
            details=details,
        )
    )
