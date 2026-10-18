import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AuthError, ConflictError, ForbiddenError, UnprocessableError, require
from app.core.security import (
    burn_verify_time,
    hash_password,
    needs_rehash,
    verify_password,
)
from app.models import User, Workspace
from app.models.enums import UserRole
from app.schemas.auth import RegisterRequest, UserCreate, UserUpdate
from app.services.activity import log_activity

EMAIL_TAKEN = "An account with this email already exists"


def register(db: Session, data: RegisterRequest) -> User:
    email = str(data.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise ConflictError(EMAIL_TAKEN)
    workspace = Workspace(name=data.workspace_name)
    db.add(workspace)
    db.flush()
    user = User(
        workspace_id=workspace.id,
        email=email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=UserRole.ADMIN,
    )
    db.add(user)
    db.flush()
    log_activity(
        db,
        workspace_id=workspace.id,
        actor_id=user.id,
        action="workspace.created",
        entity_type="workspace",
        entity_id=workspace.id,
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError(EMAIL_TAKEN) from None
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None:
        burn_verify_time(password)
        raise AuthError("Invalid email or password")
    if not verify_password(password, user.password_hash) or not user.is_active:
        raise AuthError("Invalid email or password")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        db.commit()
    return user


def create_user(db: Session, admin: User, data: UserCreate) -> User:
    email = str(data.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise ConflictError(EMAIL_TAKEN)
    user = User(
        workspace_id=admin.workspace_id,
        email=email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.flush()
    log_activity(
        db,
        workspace_id=admin.workspace_id,
        actor_id=admin.id,
        action="user.created",
        entity_type="user",
        entity_id=user.id,
        details={"role": data.role.value},
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ConflictError(EMAIL_TAKEN) from None
    return user


def update_user(db: Session, admin: User, user_id: uuid.UUID, data: UserUpdate) -> User:
    target = require(
        db.scalar(
            select(User).where(User.id == user_id, User.workspace_id == admin.workspace_id)
        ),
        "User",
    )
    if target.id == admin.id:
        raise UnprocessableError("You cannot change your own role or active status")
    if _is_protected(target.email):
        raise ForbiddenError("This is a shared demo account and can't be modified")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("role") is None:
        changes.pop("role", None)
    if changes.get("is_active") is None:
        changes.pop("is_active", None)
    for key, value in changes.items():
        setattr(target, key, value)
    log_activity(
        db,
        workspace_id=admin.workspace_id,
        actor_id=admin.id,
        action="user.updated",
        entity_type="user",
        entity_id=target.id,
        details={"fields": sorted(changes)},
    )
    db.commit()
    return target


def _is_protected(email: str) -> bool:
    return email.lower() in {e.lower() for e in get_settings().protected_account_emails}


def change_password(db: Session, user: User, current: str, new: str) -> User:
    if _is_protected(user.email):
        raise ForbiddenError("This is a shared demo account. Its password can't be changed.")
    if not verify_password(current, user.password_hash):
        raise UnprocessableError("Current password is incorrect")
    if current == new:
        raise UnprocessableError("Choose a password different from your current one")
    user.password_hash = hash_password(new)
    user.password_changed_at = datetime.now(UTC)
    log_activity(
        db,
        workspace_id=user.workspace_id,
        actor_id=user.id,
        action="user.password_changed",
        entity_type="user",
        entity_id=user.id,
    )
    db.commit()
    return user
