from app.tests.helpers import API, add_user, apply, make_candidate, make_job, move


def test_viewer_is_read_only(admin, make_client):
    make_candidate(admin)
    viewer = add_user(admin, make_client, "viewer@acme.test", "VIEWER")
    assert viewer.get(f"{API}/candidates").status_code == 200
    body = {"full_name": "X", "email": "x@example.test"}
    assert viewer.post(f"{API}/candidates", json=body).status_code == 403
    assert viewer.post(f"{API}/jobs", json={"title": "T", "description": "D"}).status_code == 403
    assert viewer.post(f"{API}/users", json={}).status_code == 403


def test_recruiter_can_write_but_not_manage_users(admin, make_client):
    rec = add_user(admin, make_client, "rec@acme.test", "RECRUITER")
    make_candidate(rec)
    pw = "another-long-password"
    r = rec.post(
        f"{API}/users",
        json={"full_name": "N", "email": "n@acme.test", "password": pw, "role": "VIEWER"},
    )
    assert r.status_code == 403


def test_viewer_cannot_change_stage(admin, make_client):
    cand, job = make_candidate(admin), make_job(admin)
    app_ = apply(admin, cand["id"], job["id"])
    viewer = add_user(admin, make_client, "viewer@acme.test", "VIEWER")
    assert move(viewer, app_["id"], "SCREENING").status_code == 403


def test_workspaces_are_isolated(admin, other_admin):
    cand, job = make_candidate(admin), make_job(admin)
    app_ = apply(admin, cand["id"], job["id"])

    assert other_admin.get(f"{API}/candidates/{cand['id']}").status_code == 404
    assert other_admin.get(f"{API}/jobs/{job['id']}").status_code == 404
    assert other_admin.get(f"{API}/applications/{app_['id']}").status_code == 404
    assert other_admin.get(f"{API}/applications/{app_['id']}/history").status_code == 404
    assert other_admin.patch(f"{API}/candidates/{cand['id']}", json={"full_name": "Hax"}).status_code == 404
    assert other_admin.delete(f"{API}/candidates/{cand['id']}").status_code == 404
    assert move(other_admin, app_["id"], "SCREENING").status_code == 404
    assert other_admin.get(f"{API}/candidates").json()["total"] == 0
    assert other_admin.get(f"{API}/applications").json()["total"] == 0

    # Foreign IDs mixed into a create request behave like missing records.
    mine = make_candidate(other_admin, email="mine@globex.test")
    r = other_admin.post(
        f"{API}/applications", json={"candidate_id": mine["id"], "job_id": job["id"]}
    )
    assert r.status_code == 404
    r = other_admin.post(
        f"{API}/applications", json={"candidate_id": cand["id"], "job_id": job["id"]}
    )
    assert r.status_code == 404


def test_same_email_allowed_in_different_workspaces(admin, other_admin):
    make_candidate(admin, email="shared@example.test")
    make_candidate(other_admin, email="shared@example.test")


def test_admin_cannot_change_own_role(admin):
    me = admin.get(f"{API}/auth/me").json()
    r = admin.patch(f"{API}/users/{me['id']}", json={"role": "VIEWER"})
    assert r.status_code == 422


def test_admin_can_deactivate_user_and_session_stops_working(admin, make_client):
    rec = add_user(admin, make_client, "rec@acme.test", "RECRUITER")
    users = admin.get(f"{API}/users").json()
    rec_id = next(u["id"] for u in users if u["email"] == "rec@acme.test")
    assert admin.patch(f"{API}/users/{rec_id}", json={"is_active": False}).status_code == 200
    assert rec.get(f"{API}/auth/me").status_code == 401
