import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import update

from app.db.session import SessionLocal
from app.models import Interview
from app.tests.helpers import API, add_user, apply, make_candidate, make_job, move


def future(days: int = 2) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


def body(app_id: str, **overrides):
    return {
        "application_id": app_id,
        "interviewer_name": "Priya Nair",
        "interview_type": "TECHNICAL",
        "scheduled_at": future(),
        "duration_minutes": 45,
        **overrides,
    }


def make_interview(c, app_id: str, **overrides):
    r = c.post(f"{API}/interviews", json=body(app_id, **overrides))
    assert r.status_code == 201, r.text
    return r.json()


def make_past(interview_id: str) -> None:
    with SessionLocal() as db:
        db.execute(
            update(Interview)
            .where(Interview.id == uuid.UUID(interview_id))
            .values(scheduled_at=datetime.now(UTC) - timedelta(hours=3))
        )
        db.commit()


@pytest.fixture
def app_(admin):
    return apply(admin, make_candidate(admin)["id"], make_job(admin)["id"])


def test_schedule_returns_context(admin, app_):
    i = make_interview(admin, app_["id"], meeting_link="https://meet.example.com/x")
    assert i["status"] == "SCHEDULED"
    assert i["candidate_name"] == "Ada Lovelace" and i["job_title"] == "Backend Engineer"
    assert admin.get(f"{API}/interviews/{i['id']}").json()["meeting_link"].startswith("https://")
    actions = {a["action"] for a in admin.get(f"{API}/candidates/{app_['candidate_id']}/activity").json()}
    assert "interview.scheduled" in actions


def test_validation(admin, app_):
    def post(**o):
        return admin.post(f"{API}/interviews", json=body(app_["id"], **o))

    assert post(scheduled_at="2030-01-01T10:00:00").status_code == 422  # naive datetime
    assert post(scheduled_at=(datetime.now(UTC) - timedelta(days=1)).isoformat()).status_code == 422
    assert post(duration_minutes=0).status_code == 422
    assert post(duration_minutes=1000).status_code == 422
    assert post(meeting_link="ftp://nope").status_code == 422
    assert post(interviewer_name="  ").status_code == 422
    r = admin.post(f"{API}/interviews", json=body(str(uuid.uuid4())))
    assert r.status_code == 404


def test_only_active_applications(admin, app_):
    move(admin, app_["id"], "REJECTED", "no")
    r = admin.post(f"{API}/interviews", json=body(app_["id"]))
    assert r.status_code == 422


def test_workspace_isolation_and_roles(admin, other_admin, make_client, app_):
    i = make_interview(admin, app_["id"])
    assert other_admin.get(f"{API}/interviews/{i['id']}").status_code == 404
    assert other_admin.patch(f"{API}/interviews/{i['id']}", json={"notes": "x"}).status_code == 404
    assert other_admin.post(f"{API}/interviews", json=body(app_["id"])).status_code == 404
    assert other_admin.get(f"{API}/interviews").json()["total"] == 0

    viewer = add_user(admin, make_client, "viewer@acme.test", "VIEWER")
    assert viewer.get(f"{API}/interviews").status_code == 200
    assert viewer.post(f"{API}/interviews", json=body(app_["id"])).status_code == 403


def test_status_rules(admin, app_):
    i = make_interview(admin, app_["id"])
    url = f"{API}/interviews/{i['id']}"
    assert admin.patch(url, json={"status": "COMPLETED"}).status_code == 422  # still in the future
    assert admin.patch(url, json={"status": None}).status_code == 422
    assert admin.patch(url, json={"status": "CANCELLED"}).json()["status"] == "CANCELLED"
    assert admin.patch(url, json={"interviewer_name": "Someone"}).status_code == 409
    assert admin.patch(url, json={"notes": "Cancelled by candidate"}).status_code == 200


def test_complete_a_past_interview(admin, app_):
    i = make_interview(admin, app_["id"])
    make_past(i["id"])
    r = admin.patch(f"{API}/interviews/{i['id']}", json={"status": "COMPLETED", "notes": "Strong"})
    assert r.status_code == 200 and r.json()["status"] == "COMPLETED"
    actions = {a["action"] for a in admin.get(f"{API}/candidates/{app_['candidate_id']}/activity").json()}
    assert "interview.status_changed" in actions


def test_reschedule(admin, app_):
    i = make_interview(admin, app_["id"])
    url = f"{API}/interviews/{i['id']}"
    past = (datetime.now(UTC) - timedelta(hours=1)).isoformat()
    assert admin.patch(url, json={"scheduled_at": past}).status_code == 422
    assert admin.patch(url, json={"scheduled_at": future(5)}).status_code == 200


def test_list_filters_and_order(admin):
    job = make_job(admin)
    a1 = apply(admin, make_candidate(admin, "a@example.test", full_name="Alpha")["id"], job["id"])
    a2 = apply(admin, make_candidate(admin, "b@example.test", full_name="Bravo")["id"], job["id"])
    first = make_interview(admin, a1["id"], scheduled_at=future(3))
    second = make_interview(admin, a2["id"], scheduled_at=future(1))
    admin.patch(f"{API}/interviews/{first['id']}", json={"status": "CANCELLED"})

    up = admin.get(f"{API}/interviews", params={"upcoming": True}).json()
    assert [i["id"] for i in up["items"]] == [second["id"]]
    assert admin.get(f"{API}/interviews", params={"status": "CANCELLED"}).json()["total"] == 1
    by_cand = admin.get(f"{API}/interviews", params={"candidate_id": a1["candidate_id"]}).json()
    assert by_cand["total"] == 1
    asc = admin.get(f"{API}/interviews", params={"order": "asc"}).json()["items"]
    assert [i["id"] for i in asc] == [second["id"], first["id"]]
    bad = admin.get(f"{API}/interviews", params={"date_from": "2030-02-01", "date_to": "2030-01-01"})
    assert bad.status_code == 422
