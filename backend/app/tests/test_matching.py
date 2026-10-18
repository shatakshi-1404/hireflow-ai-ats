import pytest

from app.ai.matcher import MatchWeights, compute_match
from app.schemas.ai import CandidateInput, JobInput
from app.tests.helpers import (
    API,
    SAMPLE_RESUME,
    add_user,
    apply,
    make_candidate,
    make_job,
    make_pdf,
    upload_resume,
)

W = MatchWeights(required=0.45, preferred=0.15, text=0.2, experience=0.2, text_saturation=0.4)
RESUME = "Six years building services. I use Python daily and run PostgreSQL in production. " * 3


def job(**o) -> JobInput:
    base = dict(
        title="Backend Engineer",
        description="Build REST APIs with Python and PostgreSQL.",
        required_skills=["python", "docker"],
        preferred_skills=["postgres"],
        min_experience=2,
        max_experience=6,
    )
    return JobInput(**{**base, **o})


def cand(**o) -> CandidateInput:
    base = dict(skills=["python"], years_experience=4, resume_text=None, summary=None, current_title=None)
    return CandidateInput(**{**base, **o})


def by_key(d):
    return {c.key: c for c in d.components}


def test_matcher_input_has_no_personal_attributes():
    forbidden = {"full_name", "name", "email", "phone", "photo", "gender", "age"}
    assert not forbidden & set(CandidateInput.model_fields)


def test_evidence_and_unverified_skills():
    d = compute_match(cand(resume_text=RESUME), job(), W)
    assert [s.skill for s in d.matched_required] == ["python"]
    assert d.matched_required[0].source == "resume" and "Python" in d.matched_required[0].evidence
    assert [s.skill for s in d.unverified_required] == ["docker"]
    assert "does not mean" in d.unverified_required[0].note
    assert [s.skill for s in d.matched_preferred] == ["postgresql"]  # alias of job's "postgres"
    c = by_key(d)
    assert c["required_skills"].value == 0.5 and c["preferred_skills"].value == 1.0
    assert c["experience"].value == 1.0 and 0 < c["text_relevance"].value <= 1.0
    assert abs(sum(x.weight for x in d.components) - 1.0) < 0.001
    expected = 100 * sum(x.value * x.weight for x in d.components if x.value is not None)
    assert abs(d.score - expected) < 0.2


def test_no_resume_uses_profile_and_says_so():
    d = compute_match(cand(), job(), W)
    assert d.matched_required[0].source == "profile" and d.matched_required[0].evidence is None
    assert any("No resume text" in w for w in d.warnings)
    c = by_key(d)
    assert c["text_relevance"].value is None and c["text_relevance"].weight == 0.0
    assert abs(d.score - 53.1) < 0.11  # (0.5*.45 + 0*.15 + 1*.2) / 0.8; the candidate has no preferred skill


def test_experience_fit_and_unknowns():
    below = by_key(compute_match(cand(years_experience=1), job(), W))["experience"]
    assert below.value == 0.5
    above = by_key(compute_match(cand(years_experience=15), job(), W))["experience"]
    assert above.value == 1.0  # seniority is not penalised
    unknown = compute_match(cand(years_experience=None), job(), W)
    assert by_key(unknown)["experience"].value is None and unknown.score is not None


def test_job_without_skills_excludes_those_components():
    d = compute_match(cand(resume_text=RESUME), job(required_skills=[], preferred_skills=[]), W)
    c = by_key(d)
    assert c["required_skills"].value is None and c["preferred_skills"].value is None
    assert d.score is not None


@pytest.fixture
def setup(admin):
    c = make_candidate(admin)  # skills python, fastapi; 4 years
    j = make_job(admin, required_skills=["python", "docker"], preferred_skills=["fastapi"])
    return c, j, apply(admin, c["id"], j["id"])


def test_match_endpoint_persists_and_caches_score(admin, setup):
    c, j, app_ = setup
    r = admin.post(f"{API}/ai/match", json={"candidate_id": c["id"], "job_id": j["id"]})
    assert r.status_code == 200, r.text
    m = r.json()
    assert m["provider"] == "deterministic" and abs(m["score"] - 71.9) < 0.11
    assert m["application_id"] == app_["id"]
    assert m["unverified_required"][0]["skill"] == "docker"
    assert "not a prediction" in m["disclaimer"]
    assert admin.get(f"{API}/applications/{app_['id']}").json()["match_score"] == m["score"]
    rows = admin.get(f"{API}/ai/analyses", params={"candidate_id": c["id"], "kind": "JOB_MATCH"}).json()
    assert len(rows) == 1 and rows[0]["result"]["score"] == m["score"]


def test_confirming_a_resume_clears_stale_scores(admin, setup):
    c, j, app_ = setup
    admin.post(f"{API}/ai/match", json={"candidate_id": c["id"], "job_id": j["id"]})
    a = upload_resume(admin, c["id"], make_pdf(SAMPLE_RESUME)).json()
    admin.post(
        f"{API}/ai/resume-analysis/{a['analysis_id']}/confirm",
        json={"skills": ["python", "fastapi", "docker"]},
    )
    assert admin.get(f"{API}/applications/{app_['id']}").json()["match_score"] is None
    m = admin.post(f"{API}/ai/match", json={"candidate_id": c["id"], "job_id": j["id"]}).json()
    assert m["matched_required"][0]["source"] == "resume"
    assert not m["unverified_required"]  # docker is both in the profile and the resume


def test_match_permissions_and_isolation(admin, other_admin, make_client, setup):
    c, j, _ = setup
    body = {"candidate_id": c["id"], "job_id": j["id"]}
    assert other_admin.post(f"{API}/ai/match", json=body).status_code == 404
    mine = make_candidate(other_admin, "mine@globex.test")
    assert other_admin.post(f"{API}/ai/match", json={"candidate_id": mine["id"], "job_id": j["id"]}).status_code == 404
    viewer = add_user(admin, make_client, "viewer@acme.test", "VIEWER")
    assert viewer.post(f"{API}/ai/match", json=body).status_code == 403
