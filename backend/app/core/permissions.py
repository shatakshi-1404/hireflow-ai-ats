from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.session import DbSession
from app.models import User
from app.models.enums import UserRole

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: DbSession,
) -> User:
    token = creds.credentials if creds else request.cookies.get(get_settings().cookie_name)
    claims = decode_access_token(token) if token else None
    user = db.get(User, claims.user_id) if claims else None
    revoked = bool(
        claims
        and user
        and user.password_changed_at
        and claims.issued_at < int(user.password_changed_at.timestamp())
    )
    if user is None or not user.is_active or revoked:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole) -> Callable[[User], User]:
    def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return checker


# Admin + Recruiter may modify records; Viewer is read-only; only Admin manages users.
WriterUser = Annotated[User, Depends(require_roles(UserRole.ADMIN, UserRole.RECRUITER))]
AdminUser = Annotated[User, Depends(require_roles(UserRole.ADMIN))]
