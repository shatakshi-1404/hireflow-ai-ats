from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.permissions import AdminUser
from app.core.rate_limit import client_key
from app.db.session import get_db

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/db")
def health_db(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}


@router.get("/client-key")
def client_key_debug(request: Request, admin: AdminUser) -> dict[str, object]:
    """Admin only. Shows what the rate limiter keys on, to set TRUSTED_PROXY_COUNT correctly."""
    return {
        "key": client_key(request),
        "x_forwarded_for": request.headers.get("x-forwarded-for"),
        "trusted_proxy_count": get_settings().trusted_proxy_count,
    }
