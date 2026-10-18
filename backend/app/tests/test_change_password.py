from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import get_settings
from app.tests.helpers import API, PASSWORD, add_user, signup

NEW = "a-brand-new-passphrase"


def change(c, current: str = PASSWORD, new: str = NEW):
    return c.post(f"{API}/auth/change-password", json={"current_password": current, "new_password": new})


def old_token(user_id: str) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    return jwt.encode(
        {"sub": user_id, "iat": now - timedelta(minutes=5), "exp": now + timedelta(minutes=20)},
        s.secret_key,
        algorithm=s.jwt_algorithm,
    )


def test_requires_authentication(make_client):
    assert change(make_client()).status_code == 401


def test_validation_and_wrong_current_password(admin):
    assert change(admin, current="not-the-password").status_code == 422
    assert change(admin, new="short").status_code == 422
    assert change(admin, new=PASSWORD).status_code == 422
    # Nothing changed.
    assert admin.get(f"{API}/auth/me").status_code == 200


def test_change_password_end_to_end(admin, make_client):
    assert change(admin).status_code == 204
    assert admin.get(f"{API}/auth/me").status_code == 200  # this session got a fresh cookie

    other = make_client()
    body = {"email": "admin@acme.test", "password": PASSWORD}
    assert other.post(f"{API}/auth/login", json=body).status_code == 401
    assert other.post(f"{API}/auth/login", json={**body, "password": NEW}).status_code == 200


def test_older_sessions_are_revoked(admin, make_client):
    user_id = admin.get(f"{API}/auth/me").json()["id"]
    headers = {"Authorization": f"Bearer {old_token(user_id)}"}
    stale = make_client()
    assert stale.get(f"{API}/auth/me", headers=headers).status_code == 200
    assert change(admin).status_code == 204
    assert stale.get(f"{API}/auth/me", headers=headers).status_code == 401


def test_protected_accounts_cannot_be_locked_out(admin, make_client, monkeypatch):
    add_user(admin, make_client, "rec@acme.test", "RECRUITER")
    rec_id = next(u["id"] for u in admin.get(f"{API}/users").json() if u["email"] == "rec@acme.test")
    monkeypatch.setattr(
        get_settings(), "protected_account_emails", ["ADMIN@acme.test", "rec@acme.test"]
    )
    assert change(admin).status_code == 403
    assert admin.patch(f"{API}/users/{rec_id}", json={"is_active": False}).status_code == 403
    assert admin.patch(f"{API}/users/{rec_id}", json={"role": "VIEWER"}).status_code == 403


def test_signup_still_works_for_other_workspaces(make_client):
    signup(make_client(), "someone@else.test", "Else")
