import json

import pytest

from app.ai.provider import ProviderError
from app.tests.helpers import API, FakeProvider, add_user, make_candidate, make_job


@pytest.fixture
def ctx(admin):
    c = make_candidate(admin)
    j = make_job(admin, required_skills=["python", "docker"], preferred_skills=["fastapi"])
    return c, j


def ask(client, ctx, **o):
    c, j = ctx
    return client.post(
        f"{API}/ai/interview-questions", json={"candidate_id": c["id"], "job_id": j["id"], **o}
    )


def test_template_questions_are_structured_and_labelled(admin, ctx):
    r = ask(admin, ctx)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provider"] == "template" and body["model"] is None
    assert any("not a language model" in w for w in body["warnings"])
    qs = body["questions"]
    assert len(qs) == 6  # 45 minutes
    assert {q["category"] for q in qs} == {"technical", "behavioral"}
    assert all(q["difficulty"] == "medium" and q["evaluation_criteria"] for q in qs)
    assert any(q["follow_up"] and "Your profile lists python" in q["follow_up"] for q in qs)
    assert len({q["question"] for q in qs}) == len(qs)  # no duplicates


def test_regenerate_changes_questions_and_filters_apply(admin, ctx):
    first = [q["question"] for q in ask(admin, ctx).json()["questions"]]
    again = [q["question"] for q in ask(admin, ctx, variant=1).json()["questions"]]
    assert first != again
    tech = ask(admin, ctx, category="technical", difficulty="hard", duration_minutes=60).json()["questions"]
    assert {q["category"] for q in tech} == {"technical"} and {q["difficulty"] for q in tech} == {"hard"}
    beh = ask(admin, ctx, category="behavioral", duration_minutes=15).json()["questions"]
    assert len(beh) == 3 and {q["category"] for q in beh} == {"behavioral"}


def test_validation_permissions_and_isolation(admin, other_admin, make_client, ctx):
    assert ask(admin, ctx, duration_minutes=5).status_code == 422
    assert ask(admin, ctx, difficulty="impossible").status_code == 422
    assert ask(other_admin, ctx).status_code == 404
    viewer = add_user(admin, make_client, "viewer@acme.test", "VIEWER")
    assert ask(viewer, ctx).status_code == 403


def test_model_questions_are_validated_and_normalised(admin, ctx, monkeypatch):
    reply = json.dumps(
        {
            "questions": [
                {"question": "Explain Python's GIL.", "category": "technical", "difficulty": "hard",
                 "competencies": ["python"], "evaluation_criteria": ["Accurate explanation"], "follow_up": None},
                {"question": "Tell me about a conflict.", "category": "behavioral", "difficulty": "easy",
                 "competencies": ["communication"], "evaluation_criteria": ["Specific example"]},
            ]
        }
    )
    fake = FakeProvider(reply)
    monkeypatch.setattr("app.ai.provider.get_provider", lambda: fake)
    body = ask(admin, ctx, category="technical", difficulty="medium").json()
    assert body["provider"] == "fake"
    assert len(body["questions"]) == 1 and body["questions"][0]["difficulty"] == "medium"
    assert any("usable questions" in w for w in body["warnings"])
    assert "Never invent facts" in fake.calls[0]["system"]


@pytest.mark.parametrize(
    "fake",
    [
        FakeProvider(reply="nope"),
        FakeProvider(reply='{"questions": [{"question": "x"}]}'),
        FakeProvider(error=ProviderError("timeout")),
    ],
)
def test_provider_failure_falls_back_to_templates(admin, ctx, monkeypatch, fake):
    monkeypatch.setattr("app.ai.provider.get_provider", lambda: fake)
    body = ask(admin, ctx).json()
    assert body["provider"] == "template" and len(body["questions"]) == 6
    assert any("templates were used instead" in w for w in body["warnings"])


def test_save_and_list(admin, ctx, make_client):
    c, j = ctx
    qs = ask(admin, ctx).json()["questions"]
    r = admin.post(
        f"{API}/ai/interview-questions/save",
        json={"candidate_id": c["id"], "job_id": j["id"], "provider": "template", "questions": qs},
    )
    assert r.status_code == 201, r.text
    rows = admin.get(
        f"{API}/ai/analyses",
        params={"candidate_id": c["id"], "kind": "INTERVIEW_QUESTIONS", "job_id": j["id"]},
    ).json()
    assert len(rows) == 1 and len(rows[0]["result"]["questions"]) == 6 and rows[0]["is_confirmed"]

    bad = admin.post(
        f"{API}/ai/interview-questions/save",
        json={"candidate_id": c["id"], "job_id": j["id"], "provider": "template", "questions": []},
    )
    assert bad.status_code == 422
    viewer = add_user(admin, make_client, "viewer@acme.test", "VIEWER")
    denied = viewer.post(
        f"{API}/ai/interview-questions/save",
        json={"candidate_id": c["id"], "job_id": j["id"], "provider": "template", "questions": qs},
    )
    assert denied.status_code == 403
