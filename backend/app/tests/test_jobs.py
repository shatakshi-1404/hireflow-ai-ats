from app.tests.helpers import API, apply, make_candidate, make_job


def test_create_get_and_empty_stage_counts(admin):
    job = make_job(admin)
    r = admin.get(f"{API}/jobs/{job['id']}").json()
    assert r["status"] == "OPEN" and r["applicant_count"] == 0
    assert r["stage_counts"]["APPLIED"] == 0 and len(r["stage_counts"]) == 8


def test_experience_range_validation(admin):
    bad = {"title": "T", "description": "D", "min_experience": 5, "max_experience": 2}
    assert admin.post(f"{API}/jobs", json=bad).status_code == 422
    job = make_job(admin)  # 2..6
    assert admin.patch(f"{API}/jobs/{job['id']}", json={"max_experience": 1}).status_code == 422
    assert admin.patch(f"{API}/jobs/{job['id']}", json={"title": None}).status_code == 422


def test_close_and_reopen(admin):
    job = make_job(admin)
    closed = admin.patch(f"{API}/jobs/{job['id']}", json={"status": "CLOSED"}).json()
    assert closed["status"] == "CLOSED" and closed["closed_at"] is not None
    reopened = admin.patch(f"{API}/jobs/{job['id']}", json={"status": "OPEN"}).json()
    assert reopened["closed_at"] is None


def test_list_filters_and_applicant_count(admin):
    open_job = make_job(admin, title="Open Role", department="Eng")
    make_job(admin, title="Old Role", status="CLOSED")
    apply(admin, make_candidate(admin)["id"], open_job["id"])

    r = admin.get(f"{API}/jobs", params={"status": "OPEN"}).json()
    assert [j["title"] for j in r["items"]] == ["Open Role"]
    assert r["items"][0]["applicant_count"] == 1
    assert admin.get(f"{API}/jobs", params={"q": "old"}).json()["total"] == 1
    assert admin.get(f"{API}/jobs", params={"department": "Eng"}).json()["total"] == 1
