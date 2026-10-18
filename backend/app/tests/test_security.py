import uuid

import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.ai.pdf_text import PdfError  # noqa: F401  (import check)
from app.core.config import get_settings
from app.core.middleware import SecurityHeadersMiddleware
from app.core.rate_limit import client_key
from app.core.storage import get_storage
from app.services.ai_service import _display_name
from app.tests.helpers import API, make_candidate


def test_security_headers_on_success_and_error_responses(make_client):
    c = make_client()
    ok = c.get(f"{API}/health")
    denied = c.get(f"{API}/candidates")
    for r in (ok, denied):
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.headers["x-frame-options"] == "DENY"
        assert r.headers["referrer-policy"] == "no-referrer"
        assert r.headers["cache-control"] == "no-store"
    assert denied.status_code == 401
    assert "strict-transport-security" not in ok.headers  # cookie_secure is off in tests


def test_hsts_only_when_enabled():
    def client(hsts: bool) -> TestClient:
        inner = Starlette(routes=[Route("/", lambda request: PlainTextResponse("ok"))])
        return TestClient(SecurityHeadersMiddleware(inner, hsts=hsts))

    assert "strict-transport-security" in client(True).get("/").headers
    assert "strict-transport-security" not in client(False).get("/").headers


def test_cross_origin_writes_are_blocked(admin):
    def create(email: str, origin: str):
        return admin.post(
            f"{API}/candidates",
            json={"full_name": "X", "email": email},
            headers={"Origin": origin},
        )

    assert create("a@example.test", "https://evil.example").status_code == 403
    assert create("b@example.test", "null").status_code == 403
    assert create("c@example.test", "http://localhost:5173").status_code == 201  # allowed origin
    assert create("d@example.test", "http://testserver").status_code == 201  # same host
    # Reads are never blocked by this check, and a missing Origin (non-browser client) passes.
    assert admin.get(f"{API}/candidates", headers={"Origin": "https://evil.example"}).status_code == 200
    assert admin.post(f"{API}/candidates", json={"full_name": "Y", "email": "e@example.test"}).status_code == 201
    assert admin.get(f"{API}/candidates").json()["total"] == 3


def test_oversized_bodies_are_refused_early(admin):
    json_headers = {"Content-Type": "application/json"}
    r = admin.post(f"{API}/candidates", content=b"x" * 1_000_001, headers=json_headers)
    assert r.status_code == 413
    r = admin.post(f"{API}/ai/resume-analysis", content=b"x" * 5_200_000)
    assert r.status_code == 413
    r = admin.post(f"{API}/candidates/import", content=b"x" * 5_200_000)
    assert r.status_code == 413


def _request(forwarded: str | None, client_ip: str = "9.9.9.9") -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request({"type": "http", "headers": headers, "client": (client_ip, 1234)})


def test_rate_limit_key_ignores_forwarded_for_by_default():
    assert client_key(_request("6.6.6.6")) == "9.9.9.9"


def test_rate_limit_key_uses_the_proxy_appended_hop(monkeypatch):
    monkeypatch.setattr(get_settings(), "trusted_proxy_count", 1)
    # The client forged the first entry. The proxy appended the real address last.
    assert client_key(_request("6.6.6.6, 1.2.3.4")) == "1.2.3.4"
    assert client_key(_request(None)) == "9.9.9.9"


def test_storage_rejects_path_traversal():
    storage = get_storage()
    for bad in ("../../etc/passwd", "/etc/passwd", "..\\..\\secret"):
        with pytest.raises(ValueError):
            storage.read(bad)


def test_user_filenames_are_sanitised_for_display_only():
    assert _display_name("../../evil.pdf") == "evil.pdf"
    assert _display_name("..\\..\\evil.pdf") == "evil.pdf"
    assert _display_name("a<b>.pdf") == "a_b_.pdf"
    assert _display_name("") == "resume.pdf"


def test_remaining_endpoints_isolate_workspaces(admin, other_admin):
    cand = make_candidate(admin)
    cid = cand["id"]
    for path in (f"/candidates/{cid}/notes", f"/candidates/{cid}/activity", f"/candidates/{cid}/resume"):
        assert other_admin.get(f"{API}{path}").status_code == 404, path
    assert other_admin.post(f"{API}/candidates/{cid}/notes", json={"body": "x"}).status_code == 404
    assert other_admin.get(f"{API}/ai/analyses", params={"candidate_id": cid}).status_code == 404

    admin_id = admin.get(f"{API}/auth/me").json()["id"]
    assert other_admin.patch(f"{API}/users/{admin_id}", json={"is_active": False}).status_code == 404
    assert admin_id not in {u["id"] for u in other_admin.get(f"{API}/users").json()}
    assert other_admin.get(f"{API}/interviews/{uuid.uuid4()}").status_code == 404
    assert admin.get(f"{API}/auth/me").status_code == 200  # untouched
