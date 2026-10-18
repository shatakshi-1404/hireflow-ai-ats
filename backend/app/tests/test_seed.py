import pytest

from app.db.session import SessionLocal
from app.seed import DEMO_ADMIN, SeedError, seed
from app.tests.helpers import API

PW = "seed-test-password"


def test_seed_is_consistent_with_analytics(make_client):
    with SessionLocal() as db:
        summary = seed(db, password=PW)
    assert summary["candidates"] == 40 and summary["applications"] > 20

    c = make_client()
    assert c.post(f"{API}/auth/login", json={"email": DEMO_ADMIN, "password": PW}).status_code == 200

    p = c.get(f"{API}/analytics/pipeline").json()
    reached = [s["reached"] for s in p["funnel"]]
    assert reached == sorted(reached, reverse=True)  # a funnel never grows
    assert p["cohort_size"] == summary["applications"]
    assert sum(s["count"] for s in p["stage_distribution"]) == summary["applications"]

    o = c.get(f"{API}/analytics/overview").json()
    assert sum(x["count"] for x in o["applications_over_time"]) == summary["applications"]
    assert o["kpis"]["total_candidates"] == 40 and o["kpis"]["active_jobs"] == 5
    assert o["kpis"]["upcoming_interviews"] >= 1

    assert c.get(f"{API}/interviews", params={"upcoming": True}).json()["total"] >= 1


def test_seed_refuses_to_run_twice_but_can_reset():
    with SessionLocal() as db:
        seed(db, password=PW)
    with SessionLocal() as db, pytest.raises(SeedError):
        seed(db, password=PW)
    with SessionLocal() as db:
        again = seed(db, password=PW, reset=True)
    assert again["candidates"] == 40
