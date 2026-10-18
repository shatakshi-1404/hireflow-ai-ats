import uuid

from fastapi import APIRouter
from sqlalchemy import select

from app.core.permissions import AdminUser, CurrentUser
from app.db.session import DbSession
from app.models import User
from app.schemas.auth import UserCreate, UserOut, UserUpdate
from app.services import auth_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(user: CurrentUser, db: DbSession):
    return db.scalars(
        select(User).where(User.workspace_id == user.workspace_id).order_by(User.full_name)
    ).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(admin: AdminUser, db: DbSession, payload: UserCreate):
    return auth_service.create_user(db, admin, payload)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: uuid.UUID, admin: AdminUser, db: DbSession, payload: UserUpdate):
    return auth_service.update_user(db, admin, user_id, payload)
