from app.tests.helpers import API, apply, make_candidate, make_job


def test_create_normalises_email_and_skills(admin):
    c = make_candidate(admin, email="Ada@Example.TEST", skills=["  Python ", "python", "Fast  API"])
    assert c["email"] == "ada@example.test"
    assert c["skills"] == ["python", "fast api"]
    assert c["years_experience"] == 4


def test_validation_errors(admin):
    bad_email = admin.post(f"{API}/candidates", json={"full_name": "X", "email": "nope"})
    assert bad_email.status_code == 422
    neg = admin.post(
        f"{API}/candidates",
        json={"full_name": "X", "email": "x@example.test", "years_experience": -1},
    )
    assert neg.status_code == 422


def test_duplicate_email_conflict(admin):
    make_candidate(admin)
    r = admin.post(f"{API}/candidates", json={"full_name": "Dup", "email": "ADA@example.test"})
    assert r.status_code == 409


def test_search_filter_sort_paginate(admin):
    make_candidate(admin, "ada@example.test", full_name="Ada Lovelace", skills=["python", "sql"], years_experience=8)
    make_candidate(admin, "grace@example.test", full_name="Grace Hopper", skills=["cobol"], years_experience=12)
    make_candidate(admin, "linus@example.test", full_name="Linus T", skills=["c", "python"], years_experience=3)

    def names(**params):
        r = admin.get(f"{API}/candidates", params=params)
        assert r.status_code == 200, r.text
        return [c["full_name"] for c in r.json()["items"]]

    assert names(q="grace") == ["Grace Hopper"]
    assert names(q="LINUS@") == ["Linus T"]
    assert set(names(q="python")) == {"Ada Lovelace", "Linus T"}  # exact skill match
    assert set(names(skills=["python"])) == {"Ada Lovelace", "Linus T"}
    assert names(skills=["python", "sql"]) == ["Ada Lovelace"]  # ALL skills
    assert set(names(min_experience=5)) == {"Ada Lovelace", "Grace Hopper"}
    assert names(max_experience=5) == ["Linus T"]
    assert names(sort="years_experience", order="desc") == ["Grace Hopper", "Ada Lovelace", "Linus T"]
    assert names(q="%") == []  # LIKE wildcards are escaped

    page = admin.get(f"{API}/candidates", params={"page_size": 2, "sort": "full_name", "order": "asc"}).json()
    assert page["total"] == 3 and page["pages"] == 2 and len(page["items"]) == 2
    page2 = admin.get(
        f"{API}/candidates", params={"page_size": 2, "page": 2, "sort": "full_name", "order": "asc"}
    ).json()
    assert [c["full_name"] for c in page2["items"]] == ["Linus T"]


def test_filter_by_stage_and_job(admin):
    a = make_candidate(admin, "a@example.test", full_name="Has App")
    make_candidate(admin, "b@example.test", full_name="No App")
    job = make_job(admin)
    apply(admin, a["id"], job["id"])
    r = admin.get(f"{API}/candidates", params={"stage": "APPLIED", "job_id": job["id"]}).json()
    assert [c["full_name"] for c in r["items"]] == ["Has App"]
    assert admin.get(f"{API}/candidates", params={"stage": "OFFER"}).json()["total"] == 0


def test_update_archive_and_null_rejection(admin):
    c = make_candidate(admin)
    assert admin.patch(f"{API}/candidates/{c['id']}", json={"full_name": None}).status_code == 422
    r = admin.patch(f"{API}/candidates/{c['id']}", json={"current_title": "Engineer", "is_archived": True})
    assert r.status_code == 200 and r.json()["is_archived"] is True
    assert admin.get(f"{API}/candidates").json()["total"] == 0
    assert admin.get(f"{API}/candidates", params={"include_archived": True}).json()["total"] == 1


def test_update_email_conflict(admin):
    make_candidate(admin, "a@example.test")
    b = make_candidate(admin, "b@example.test")
    r = admin.patch(f"{API}/candidates/{b['id']}", json={"email": "a@example.test"})
    assert r.status_code == 409


def test_delete_rules(admin):
    free = make_candidate(admin, "free@example.test")
    assert admin.delete(f"{API}/candidates/{free['id']}").status_code == 204
    assert admin.get(f"{API}/candidates/{free['id']}").status_code == 404

    busy = make_candidate(admin, "busy@example.test")
    apply(admin, busy["id"], make_job(admin)["id"])
    assert admin.delete(f"{API}/candidates/{busy['id']}").status_code == 409


def test_detail_notes_and_activity(admin):
    c = make_candidate(admin)
    job = make_job(admin)
    apply(admin, c["id"], job["id"])

    detail = admin.get(f"{API}/candidates/{c['id']}").json()
    assert detail["applications"][0]["job_title"] == "Backend Engineer"

    assert admin.post(f"{API}/candidates/{c['id']}/notes", json={"body": "  "}).status_code == 422
    n = admin.post(f"{API}/candidates/{c['id']}/notes", json={"body": "Strong screen"})
    assert n.status_code == 201 and n.json()["author_name"] == "Test Admin"
    assert admin.get(f"{API}/candidates/{c['id']}/notes").json()[0]["body"] == "Strong screen"

    actions = {a["action"] for a in admin.get(f"{API}/candidates/{c['id']}/activity").json()}
    assert {"candidate.created", "application.created", "candidate.note_added"} <= actions
