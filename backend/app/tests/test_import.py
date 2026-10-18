from app.tests.helpers import API, add_user, make_candidate

CSV = (
    "full_name,email,skills,years_experience,source\n"
    "Grace Hopper,grace@example.test,COBOL; Compilers ,12,Referral\n"
    "Bad Email,not-an-email,python,3,\n"
    "Neg Years,neg@example.test,python,-4,\n"
    "Dup In File,grace@example.test,python,2,\n"
    "Exists Already,ada@example.test,python,2,\n"
    ",,,,\n"
    "Linus T,linus@example.test,c|git,5,Job board\n"
)


def upload(client, content, *, dry_run=False, name="candidates.csv"):
    data = content.encode() if isinstance(content, str) else content
    return client.post(
        f"{API}/candidates/import",
        params={"dry_run": dry_run},
        files={"file": (name, data, "text/csv")},
    )


def test_partial_import_reports_row_errors(admin):
    make_candidate(admin, "ada@example.test")
    r = upload(admin, CSV)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["total_rows"] == 6 and out["created"] == 2 and out["skipped"] == 4
    rows = {e["row"]: e["error"] for e in out["errors"]}
    assert set(rows) == {3, 4, 5, 6}
    assert "Duplicate email within the file" in rows[5]
    assert "Already exists" in rows[6]

    listing = admin.get(f"{API}/candidates", params={"q": "grace"}).json()["items"][0]
    assert listing["skills"] == ["cobol", "compilers"] and listing["years_experience"] == 12
    assert admin.get(f"{API}/candidates", params={"skills": ["c", "git"]}).json()["total"] == 1
    actions = {a["action"] for a in admin.get(f"{API}/candidates/{listing['id']}/activity").json()}
    assert "candidate.created" in actions


def test_dry_run_writes_nothing(admin):
    out = upload(admin, CSV, dry_run=True).json()
    assert out["dry_run"] is True and out["created"] == 0
    assert admin.get(f"{API}/candidates").json()["total"] == 0


def test_bom_and_header_case(admin):
    r = upload(admin, "\ufeffFull_Name,EMAIL\nZed Zee,zed@example.test\n")
    assert r.status_code == 200 and r.json()["created"] == 1


def test_rejects_bad_files(admin):
    assert upload(admin, "name,mail\nx,y\n").status_code == 422  # missing columns
    assert upload(admin, b"full_name,email\n\x00\x01\x02").status_code == 422  # binary
    assert upload(admin, b"\xff\xfe\x00\x00").status_code == 422
    assert upload(admin, "").status_code == 422
    assert upload(admin, b"x" * 1_000_001).status_code == 413
    many = "full_name,email\n" + "".join(f"P{i},p{i}@example.test\n" for i in range(501))
    assert upload(admin, many).status_code == 422
    assert admin.get(f"{API}/candidates").json()["total"] == 0


def test_viewer_cannot_import(admin, make_client):
    viewer = add_user(admin, make_client, "viewer@acme.test", "VIEWER")
    assert upload(viewer, CSV).status_code == 403
