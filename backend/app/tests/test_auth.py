from datetime import UTC, datetime, timedelta

import jwt
from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import User
from app.tests.helpers import API, PASSWORD, signup


def test_register_logs_in_and_me_works(make_client):
    c = make_client()
    user = signup(c)
    assert user["role"] == "ADMIN"
    me = c.get(f"{API}/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "admin@acme.test"
    assert "password" not in me.text


def test_password_hashed_with_argon2(make_client):
    signup(make_client())
    with SessionLocal() as db:
        user = db.scalar(select(User))
        assert user.password_hash.startswith("$argon2")
        assert PASSWORD not in user.password_hash


def test_weak_password_and_duplicate_email(make_client):
    c = make_client()
    r = c.post(
        f"{API}/auth/register",
        json={"full_name": "A", "email": "a@x.test", "password": "short", "workspace_name": "W"},
    )
    assert r.status_code == 422
    signup(c)
    r = c.post(
        f"{API}/auth/register",
        json={
            "full_name": "A",
            "email": "ADMIN@acme.test",
            "password": PASSWORD,
            "workspace_name": "W2",
        },
    )
    assert r.status_code == 409


def test_login_failures_are_indistinguishable(make_client):
    signup(make_client())
    c = make_client()
    bad_pw = c.post(f"{API}/auth/login", json={"email": "admin@acme.test", "password": "wrong-password"})
    unknown = c.post(f"{API}/auth/login", json={"email": "nobody@acme.test", "password": "wrong-password"})
    assert bad_pw.status_code == unknown.status_code == 401
    assert bad_pw.json() == unknown.json()


def test_login_sets_httponly_cookie_and_is_case_insensitive(make_client):
    signup(make_client())
    c = make_client()
    r = c.post(f"{API}/auth/login", json={"email": "ADMIN@ACME.TEST", "password": PASSWORD})
    assert r.status_code == 200
    assert "httponly" in r.headers["set-cookie"].lower()
    assert c.get(f"{API}/auth/me").status_code == 200


def test_protected_routes_require_auth(make_client):
    c = make_client()
    for path in ("/auth/me", "/candidates", "/jobs", "/applications", "/users"):
        assert c.get(f"{API}{path}").status_code == 401, path


def test_garbage_and_expired_tokens_rejected(make_client):
    c = make_client()
    user = signup(make_client())
    assert c.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.jwt"}).status_code == 401
    s = get_settings()
    expired = jwt.encode(
        {"sub": user["id"], "exp": datetime.now(UTC) - timedelta(minutes=1)},
        s.secret_key,
        algorithm=s.jwt_algorithm,
    )
    r = c.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert r.status_code == 401


def test_token_signed_with_other_key_rejected(make_client):
    user = signup(make_client())
    forged = jwt.encode(
        {"sub": user["id"], "exp": datetime.now(UTC) + timedelta(minutes=5)},
        "some-other-secret-key-0123456789abcdef",
        algorithm="HS256",
    )
    r = make_client().get(f"{API}/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


def test_logout_ends_session(make_client):
    c = make_client()
    signup(c)
    assert c.post(f"{API}/auth/logout").status_code == 204
    assert c.get(f"{API}/auth/me").status_code == 401
