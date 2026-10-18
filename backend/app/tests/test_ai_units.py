import pytest

from app.ai.pdf_text import PdfError, extract_pdf_text
from app.ai.resume_parser import extract_deterministic
from app.ai.skills import canonical, find_skill, scan_vocab
from app.tests.helpers import SAMPLE_RESUME, make_pdf


def test_canonical_aliases():
    assert canonical("Postgres") == "postgresql"
    assert canonical("  K8s ") == "kubernetes"
    assert canonical("Some New Tool") == "some new tool"


def test_word_boundaries_avoid_false_positives():
    assert find_skill("Worked with JavaScript daily", "java") is None
    assert find_skill("Worked with Java daily", "java")
    assert find_skill("Used node.js and React", "javascript") is None  # 'js' inside node.js
    assert find_skill("Used PostgreSQL", "sql") is None
    assert find_skill("Wrote C++ services", "c++")


def test_ambiguous_skills_need_explicit_aliases():
    assert find_skill("Ready to go to market", "go") is None
    assert find_skill("Services written in Golang", "go")


def test_pdf_extraction_and_rejections():
    text, pages = extract_pdf_text(make_pdf(SAMPLE_RESUME))
    assert pages == 1 and "FastAPI" in text
    with pytest.raises(PdfError):
        extract_pdf_text(b"not a pdf at all")
    with pytest.raises(PdfError):
        extract_pdf_text(b"%PDF-1.4\ngarbage")
    with pytest.raises(PdfError, match="OCR"):
        extract_pdf_text(make_pdf(""))


def test_deterministic_extraction_is_grounded():
    text, _ = extract_pdf_text(make_pdf(SAMPLE_RESUME))
    ext = extract_deterministic(text)
    assert {"python", "fastapi", "postgresql", "docker", "aws", "django"} <= set(ext.skills)
    assert "kubernetes" not in ext.skills
    assert all(s in ext.skill_evidence for s in ext.skills)
    assert ext.years_experience == 6 and "6 years" in (ext.years_experience_evidence or "")
    assert ext.summary is None
    assert ext.education[0].degree.lower().startswith("b") and ext.education[0].year == 2018


def test_conflicting_durations_are_not_guessed():
    ext = extract_deterministic(
        "2 years of experience in Java and 5 years of experience in sales " * 3
    )
    assert ext.years_experience is None and ext.uncertainties
