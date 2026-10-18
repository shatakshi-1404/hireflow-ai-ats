import json
import os
from pathlib import Path

import pytest

from app.ai.provider import ProviderError
from app.tests.helpers import (
    API,
    INJECTION_RESUME,
    SAMPLE_RESUME,
    FakeProvider,
    add_user,
    make_candidate,
    make_pdf,
    upload_resume,
)

PROFILE = {
    "skills": ["Python", "FastAPI", "Django"],
    "years_experience": 6,
    "summary": "Backend engineer.",
    "education": [
        {"institution": "Riverside Institute of Technology", "degree": "B.Tech", "year": 2018}
    ],
    "work_experience": [{"title": "Backend Engineer", "company": "Acme Corp", "period": "2019 - 2024"}],
    "projects": [],
}


def stored_pdfs() -> int:
    return len(list(Path(os.environ["UPLOAD_DIR"]).rglob("*.pdf")))


def use_provider(monkeypatch, fake):
    monkeypatch.setattr("app.ai.provider.get_provider", lambda: fake)


def test_status_without_provider(admin):
    body = admin.get(f"{API}/ai/status").json()
    assert body == {"configured": False, "provider": "none", "model": None, "mode": "deterministic"}


@pytest.mark.parametrize(
    ("name", "data", "status"),
    [
        ("notes.txt", make_pdf(SAMPLE_RESUME), 422),
        ("resume.pdf", b"plain text pretending to be a pdf" * 10, 422),
        ("resume.pdf", b"%PDF-1.4\ngarbage", 422),
        ("resume.pdf", make_pdf(""), 422),
        ("resume.pdf", b"", 422),
        ("resume.pdf", b"%PDF-" + b"0" * 5_000_001, 413),
    ],
)
def test_bad_uploads_are_rejected_and_nothing_is_stored(admin, name, data, status):
    cand = make_candidate(admin)
    before = stored_pdfs()
    r = upload_resume(admin, cand["id"], data, name)
    assert r.status_code == status, r.text
    assert stored_pdfs() == before


def test_scanned_pdf_error_mentions_ocr(admin):
    cand = make_candidate(admin)
    r = upload_resume(admin, cand["id"], make_pdf(""))
    assert "OCR" in r.json()["detail"]


def test_review_then_confirm_flow(admin):
    cand = make_candidate(admin, skills=["sql"], years_experience=1)
    r = upload_resume(admin, cand["id"], make_pdf(SAMPLE_RESUME))
    assert r.status_code == 201, r.text
    a = r.json()
    assert a["provider"] == "deterministic" and a["is_confirmed"] is False
    assert a["pages"] == 1 and a["filename"] == "resume.pdf"
    assert {"python", "fastapi", "postgresql"} <= set(a["extraction"]["skills"])
    assert a["extraction"]["years_experience"] == 6
    assert any("No AI provider" in w for w in a["warnings"])

    # Nothing is applied until the recruiter confirms.
    before = admin.get(f"{API}/candidates/{cand['id']}").json()
    assert before["skills"] == ["sql"] and before["years_experience"] == 1
    assert before["resume_filename"] is None
    assert admin.get(f"{API}/candidates/{cand['id']}/resume").status_code == 404

    r = admin.post(f"{API}/ai/resume-analysis/{a['analysis_id']}/confirm", json=PROFILE)
    assert r.status_code == 200, r.text
    confirmed = r.json()
    assert confirmed["skills"] == ["python", "fastapi", "django"]
    assert confirmed["years_experience"] == 6
    assert confirmed["resume_filename"] == "resume.pdf"
    assert confirmed["education"][0]["institution"] == "Riverside Institute of Technology"

    dl = admin.get(f"{API}/candidates/{cand['id']}/resume")
    assert dl.status_code == 200 and dl.content.startswith(b"%PDF")
    assert "attachment" in dl.headers["content-disposition"]
    assert dl.headers["x-content-type-options"] == "nosniff"

    listing = admin.get(
        f"{API}/ai/analyses", params={"candidate_id": cand["id"], "kind": "RESUME_ANALYSIS"}
    ).json()
    assert listing[0]["is_confirmed"] is True
    assert "source_text" not in listing[0]["result"]
    assert "storage_key" not in listing[0]["result"]["file"]
    assert listing[0]["result"]["confirmed_profile"]["skills"] == ["python", "fastapi", "django"]


def test_confirm_rules_and_isolation(admin, other_admin, make_client):
    cand = make_candidate(admin)
    a = upload_resume(admin, cand["id"], make_pdf(SAMPLE_RESUME)).json()
    url = f"{API}/ai/resume-analysis/{a['analysis_id']}/confirm"

    assert other_admin.post(url, json=PROFILE).status_code == 404
    assert upload_resume(other_admin, cand["id"], make_pdf(SAMPLE_RESUME)).status_code == 404
    viewer = add_user(admin, make_client, "viewer@acme.test", "VIEWER")
    assert upload_resume(viewer, cand["id"], make_pdf(SAMPLE_RESUME)).status_code == 403
    assert viewer.post(url, json=PROFILE).status_code == 403

    assert admin.post(url, json={**PROFILE, "years_experience": 99}).status_code == 422
    assert admin.post(url, json=PROFILE).status_code == 200
    assert admin.post(url, json=PROFILE).status_code == 409
    assert other_admin.get(f"{API}/candidates/{cand['id']}/resume").status_code == 404


def test_model_output_is_grounded_in_the_resume(admin, monkeypatch):
    reply = json.dumps(
        {
            "skills": ["Python", "Kubernetes"],
            "years_experience": 6,
            "years_experience_evidence": "6 years of experience building APIs",
            "summary": "Backend engineer.",
            "education": [{"institution": "Riverside Institute of Technology", "degree": "B.Tech", "year": 2018}],
            "work_experience": [
                {"title": "Backend Engineer", "company": "Acme Corp", "period": "2019 - 2024"},
                {"title": "CEO", "company": "Imaginary Inc"},
            ],
            "projects": [],
            "uncertainties": [],
        }
    )
    use_provider(monkeypatch, FakeProvider(reply))
    cand = make_candidate(admin)
    a = upload_resume(admin, cand["id"], make_pdf(SAMPLE_RESUME)).json()
    ext = a["extraction"]
    assert a["provider"] == "fake" and a["model"] == "fake-1"
    assert ext["skills"] == ["python"]  # kubernetes is not in the text
    assert ext["years_experience"] == 6
    assert [w["company"] for w in ext["work_experience"]] == ["Acme Corp"]
    joined = " ".join(a["warnings"]).lower()
    assert "kubernetes" in joined and "not found in the resume" in joined


def test_unverifiable_years_are_blanked(admin, monkeypatch):
    reply = json.dumps(
        {"skills": ["python"], "years_experience": 10, "years_experience_evidence": "10 years of experience"}
    )
    use_provider(monkeypatch, FakeProvider(reply))
    a = upload_resume(admin, make_candidate(admin)["id"], make_pdf(SAMPLE_RESUME)).json()
    assert a["extraction"]["years_experience"] is None
    assert any("Years of experience" in w for w in a["warnings"])


@pytest.mark.parametrize(
    "fake",
    [
        FakeProvider(reply="sorry, I cannot help with that"),
        FakeProvider(reply='{"skills": "not a list"}'),
        FakeProvider(error=ProviderError("timeout")),
        FakeProvider(error=ProviderError("HTTP 500")),
    ],
)
def test_provider_failures_fall_back_honestly(admin, monkeypatch, fake):
    use_provider(monkeypatch, fake)
    a = upload_resume(admin, make_candidate(admin)["id"], make_pdf(SAMPLE_RESUME))
    assert a.status_code == 201, a.text
    body = a.json()
    assert body["provider"] == "deterministic"
    assert any("deterministic" in w for w in body["warnings"])
    assert "python" in body["extraction"]["skills"]


def test_resume_is_fenced_in_the_prompt(admin, monkeypatch):
    fake = FakeProvider(reply=json.dumps({"skills": []}))
    use_provider(monkeypatch, fake)
    upload_resume(admin, make_candidate(admin)["id"], make_pdf(INJECTION_RESUME))
    prompt = fake.calls[0]["user"]
    assert prompt.count("<resume>") == 1 and prompt.count("</resume>") == 1
    assert "untrusted" in fake.calls[0]["system"]


def test_deleting_a_candidate_removes_stored_files(admin):
    cand = make_candidate(admin)
    before = stored_pdfs()
    a = upload_resume(admin, cand["id"], make_pdf(SAMPLE_RESUME)).json()
    admin.post(f"{API}/ai/resume-analysis/{a['analysis_id']}/confirm", json=PROFILE)
    assert stored_pdfs() == before + 1
    assert admin.delete(f"{API}/candidates/{cand['id']}").status_code == 204
    assert stored_pdfs() == before
