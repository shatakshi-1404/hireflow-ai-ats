from datetime import UTC, date, datetime, timedelta

from app.tests.helpers import API, add_user, apply, make_candidate, make_job, move


def _scenario(admin):
    job = make_job(admin)
    a = apply(admin, make_candidate(admin, "a@example.test")["id"], job["id"])
    b = apply(admin, make_candidate(admin, "b@example.test")["id"], job["id"])
    c = apply(admin, make_candidate(admin, "c@example.test")["id"], job["id"])
    for stage in ("SCREENING", "SHORTLISTED", "INTERVIEW", "OFFER"):
        assert move(admin, a["id"], stage).status_code == 200
    move(admin, b["id"], "SCREENING")
    move(admin, b["id"], "REJECTED", "not a fit")
    return a, b, c


def test_empty_workspace(admin):
    o = admin.get(f"{API}/analytics/overview").json()
    assert all(v == 0 for v in o["kpis"].values())
    assert len(o["applications_over_time"]) == 90
    assert all(p["count"] == 0 for p in o["applications_over_time"])
    p = admin.get(f"{API}/analytics/pipeline").json()
    assert p["cohort_size"] == 0
    assert all(s["conversion_from_previous"] is None for s in p["funnel"])
    assert len(p["stage_distribution"]) == 8


def test_kpis_distinguish_offer_from_hire(admin):
    a, _, _ = _scenario(admin)
    admin.post(
        f"{API}/interviews",
        json={
            "application_id": a["id"],
            "interviewer_name": "P N",
            "scheduled_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
        },
    )
    k = admin.get(f"{API}/analytics/overview").json()["kpis"]
    assert k == {
        "total_candidates": 3,
        "active_jobs": 1,
        "active_applications": 2,  # A (offer) + C (applied); B is rejected
        "upcoming_interviews": 1,
        "offers": 1,
        "hires": 0,
    }
    move(admin, a["id"], "HIRED")
    k = admin.get(f"{API}/analytics/overview").json()["kpis"]
    assert k["offers"] == 0 and k["hires"] == 1 and k["active_applications"] == 1


def test_funnel_uses_history_not_current_stage(admin):
    _scenario(admin)
    p = admin.get(f"{API}/analytics/pipeline").json()
    assert p["cohort_size"] == 3
    f = {s["stage"]: s for s in p["funnel"]}
    assert [f[s]["reached"] for s in ("APPLIED", "SCREENING", "SHORTLISTED", "INTERVIEW", "OFFER", "HIRED")] == [3, 2, 1, 1, 1, 0]
    assert f["APPLIED"]["conversion_from_previous"] is None
    assert f["SCREENING"]["conversion_from_previous"] == 0.6667
    assert f["SHORTLISTED"]["conversion_from_previous"] == 0.5
    assert f["OFFER"]["conversion_from_start"] == 0.3333
    assert f["HIRED"]["conversion_from_previous"] == 0.0
    dist = {s["stage"]: s["count"] for s in p["stage_distribution"]}
    assert dist["OFFER"] == 1 and dist["REJECTED"] == 1 and dist["APPLIED"] == 1


def test_over_time_and_date_filters(admin):
    _scenario(admin)
    o = admin.get(f"{API}/analytics/overview").json()
    assert sum(p["count"] for p in o["applications_over_time"]) == 3
    assert o["applications_over_time"][-1]["count"] == 3  # all created today (UTC)

    tomorrow = (datetime.now(UTC).date() + timedelta(days=1)).isoformat()
    p = admin.get(f"{API}/analytics/pipeline", params={"date_from": tomorrow}).json()
    assert p["cohort_size"] == 0 and all(s["reached"] == 0 for s in p["funnel"])


def test_granularity_and_range_limits(admin):
    _scenario(admin)
    w = admin.get(f"{API}/analytics/overview", params={"granularity": "week"}).json()
    assert all(date.fromisoformat(p["period"]).weekday() == 0 for p in w["applications_over_time"])
    assert sum(p["count"] for p in w["applications_over_time"]) == 3
    m = admin.get(f"{API}/analytics/overview", params={"granularity": "month"}).json()
    assert all(date.fromisoformat(p["period"]).day == 1 for p in m["applications_over_time"])
    assert sum(p["count"] for p in m["applications_over_time"]) == 3

    too_big = admin.get(f"{API}/analytics/overview", params={"date_from": "2000-01-01"})
    assert too_big.status_code == 422
    inverted = admin.get(
        f"{API}/analytics/overview", params={"date_from": "2030-02-01", "date_to": "2030-01-01"}
    )
    assert inverted.status_code == 422


def test_isolation_and_viewer_access(admin, other_admin, make_client):
    _scenario(admin)
    o = other_admin.get(f"{API}/analytics/overview").json()
    assert o["kpis"]["total_candidates"] == 0
    # Only the other workspace's own sign-up event; nothing from the first workspace leaks in.
    assert [a["action"] for a in o["recent_activity"]] == ["workspace.created"]
    assert other_admin.get(f"{API}/analytics/pipeline").json()["cohort_size"] == 0
    viewer = add_user(admin, make_client, "viewer@acme.test", "VIEWER")
    assert viewer.get(f"{API}/analytics/overview").json()["kpis"]["total_candidates"] == 3


def test_recent_activity_names(admin):
    _scenario(admin)
    recent = admin.get(f"{API}/analytics/overview").json()["recent_activity"]
    assert len(recent) == 10
    assert recent[0]["actor_name"] == "Test Admin"
