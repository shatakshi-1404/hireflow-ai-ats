import pytest

from app.tests.helpers import API, apply, make_candidate, make_job, move


@pytest.fixture
def app_(admin):
    cand, job = make_candidate(admin), make_job(admin)
    return apply(admin, cand["id"], job["id"])


def test_create_records_initial_history(admin, app_):
    assert app_["stage"] == "APPLIED"
    assert app_["allowed_next_stages"] == ["SCREENING", "REJECTED", "WITHDRAWN"]
    hist = admin.get(f"{API}/applications/{app_['id']}/history").json()
    assert len(hist) == 1
    assert hist[0]["from_stage"] is None and hist[0]["to_stage"] == "APPLIED"
    assert hist[0]["changed_by_name"] == "Test Admin"


def test_duplicate_application_rejected(admin, app_):
    r = admin.post(
        f"{API}/applications",
        json={"candidate_id": app_["candidate_id"], "job_id": app_["job_id"]},
    )
    assert r.status_code == 409


def test_same_candidate_can_apply_to_multiple_jobs(admin, app_):
    other = make_job(admin, title="Platform Engineer")
    second = apply(admin, app_["candidate_id"], other["id"])
    assert second["stage"] == "APPLIED"
    move(admin, app_["id"], "SCREENING")
    assert admin.get(f"{API}/applications/{second['id']}").json()["stage"] == "APPLIED"


def test_cannot_apply_to_closed_job_or_with_archived_candidate(admin):
    cand = make_candidate(admin)
    closed = make_job(admin, status="CLOSED")
    r = admin.post(f"{API}/applications", json={"candidate_id": cand["id"], "job_id": closed["id"]})
    assert r.status_code == 422
    admin.patch(f"{API}/candidates/{cand['id']}", json={"is_archived": True})
    r = admin.post(
        f"{API}/applications", json={"candidate_id": cand["id"], "job_id": make_job(admin)["id"]}
    )
    assert r.status_code == 422


def test_full_pipeline_to_hired_with_history(admin, app_):
    for stage in ("SCREENING", "SHORTLISTED", "INTERVIEW", "OFFER", "HIRED"):
        r = move(admin, app_["id"], stage)
        assert r.status_code == 200, r.text
        assert r.json()["stage"] == stage
    hist = admin.get(f"{API}/applications/{app_['id']}/history").json()
    assert [h["to_stage"] for h in hist] == [
        "APPLIED", "SCREENING", "SHORTLISTED", "INTERVIEW", "OFFER", "HIRED",
    ]
    assert hist[3]["from_stage"] == "SHORTLISTED"
    assert admin.get(f"{API}/applications/{app_['id']}").json()["allowed_next_stages"] == []


def test_invalid_transition_rejected_and_not_recorded(admin, app_):
    r = move(admin, app_["id"], "OFFER")
    assert r.status_code == 409 and "Allowed" in r.json()["detail"]
    assert admin.get(f"{API}/applications/{app_['id']}").json()["stage"] == "APPLIED"
    assert len(admin.get(f"{API}/applications/{app_['id']}/history").json()) == 1


def test_same_stage_rejected(admin, app_):
    assert move(admin, app_["id"], "APPLIED").status_code == 409


def test_hired_is_terminal(admin, app_):
    for stage in ("SCREENING", "SHORTLISTED", "INTERVIEW", "OFFER", "HIRED"):
        move(admin, app_["id"], stage)
    assert move(admin, app_["id"], "REJECTED").status_code == 409
    assert move(admin, app_["id"], "SCREENING").status_code == 409


def test_reject_then_reopen_requires_reason(admin, app_):
    assert move(admin, app_["id"], "REJECTED", "Not a fit").status_code == 200
    assert move(admin, app_["id"], "SCREENING").status_code == 422
    assert move(admin, app_["id"], "SCREENING", "   ").status_code == 422
    r = move(admin, app_["id"], "SCREENING", "Role requirements changed")
    assert r.status_code == 200 and r.json()["stage"] == "SCREENING"
    hist = admin.get(f"{API}/applications/{app_['id']}/history").json()
    assert hist[-1]["reason"] == "Role requirements changed"


def test_unknown_stage_value_is_422(admin, app_):
    assert move(admin, app_["id"], "NOT_A_STAGE").status_code == 422


def test_list_filters(admin):
    job = make_job(admin)
    a = apply(admin, make_candidate(admin, "a@example.test", full_name="Alpha")["id"], job["id"])
    b = apply(admin, make_candidate(admin, "b@example.test", full_name="Bravo")["id"], job["id"])
    move(admin, a["id"], "SCREENING")
    move(admin, b["id"], "REJECTED")

    def total(**params):
        return admin.get(f"{API}/applications", params=params).json()["total"]

    assert total() == 2
    assert total(stage="SCREENING") == 1
    assert total(job_id=job["id"]) == 2
    assert total(active_only=True) == 1  # rejected is not active
    assert total(q="brav") == 1
    row = admin.get(f"{API}/applications", params={"stage": "SCREENING"}).json()["items"][0]
    assert row["candidate_name"] == "Alpha" and row["job_title"] == "Backend Engineer"
