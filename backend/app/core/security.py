import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import get_settings

_hasher = PasswordHasher()
# Used to equalise timing when a login email doesn't exist.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def burn_verify_time(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


def create_access_token(user_id: uuid.UUID) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=s.access_token_expire_minutes),
    }
    return jwt.encode(payload, s.secret_key, algorithm=s.jwt_algorithm)


@dataclass(frozen=True)
class TokenClaims:
    user_id: uuid.UUID
    issued_at: int  # unix seconds; 0 if the token had no iat


def decode_access_token(token: str) -> TokenClaims | None:
    s = get_settings()
    try:
        payload = jwt.decode(
            token,
            s.secret_key,
            algorithms=[s.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
        return TokenClaims(uuid.UUID(payload["sub"]), int(payload.get("iat", 0)))
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        return None
