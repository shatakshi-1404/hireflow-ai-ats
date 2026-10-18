from fastapi import APIRouter, Request, Response

from app.core.config import get_settings
from app.core.permissions import CurrentUser
from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.db.session import DbSession
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest, UserOut
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        key=s.cookie_name,
        value=token,
        max_age=s.access_token_expire_minutes * 60,
        httponly=True,
        secure=s.cookie_secure,
        samesite=s.cookie_samesite,
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=201)
@limiter.limit("5/minute")
def register(request: Request, response: Response, payload: RegisterRequest, db: DbSession):
    user = auth_service.register(db, payload)
    _set_cookie(response, create_access_token(user.id))
    return user


@router.post("/login", response_model=UserOut)
@limiter.limit("10/minute")
def login(request: Request, response: Response, payload: LoginRequest, db: DbSession):
    user = auth_service.authenticate(db, str(payload.email), payload.password)
    _set_cookie(response, create_access_token(user.id))
    return user


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    s = get_settings()
    response.delete_cookie(
        s.cookie_name, path="/", secure=s.cookie_secure, httponly=True, samesite=s.cookie_samesite
    )


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.post("/change-password", status_code=204)
@limiter.limit("5/minute")
def change_password(
    request: Request,
    response: Response,
    payload: ChangePasswordRequest,
    user: CurrentUser,
    db: DbSession,
) -> None:
    updated = auth_service.change_password(db, user, payload.current_password, payload.new_password)
    _set_cookie(response, create_access_token(updated.id))  # keep this session, revoke older ones
