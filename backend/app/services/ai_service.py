import re
import uuid
from typing import Any

from fastapi import UploadFile
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.ai import interview_generator, matcher, resume_parser
from app.ai.pdf_text import PdfError, extract_pdf_text
from app.ai.provider import provider_status
from app.core.config import get_settings
from app.core.errors import (
    ConflictError,
    NotFoundError,
    PayloadTooLargeError,
    UnprocessableError,
    require,
)
from app.core.storage import get_storage
from app.models import AIAnalysis, Application, Candidate, User
from app.models.enums import AIAnalysisKind
from app.repositories import ai as ai_repo
from app.repositories import candidates as candidate_repo
from app.repositories import jobs as job_repo
from app.schemas.ai import (
    AnalysisOut,
    CandidateInput,
    ConfirmedProfile,
    InterviewQuestionsOut,
    InterviewQuestionsRequest,
    JobInput,
    MatchOut,
    ResumeAnalysisOut,
    ResumeExtraction,
    SaveQuestionsRequest,
)
from app.services.activity import log_activity

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._ -]")


def ai_status() -> dict[str, Any]:
    return provider_status()


def _display_name(raw: str) -> str:
    base = raw.replace("\\", "/").rsplit("/", 1)[-1]
    return _SAFE_NAME.sub("_", base).strip(" .")[:100] or "resume.pdf"


def _resume_out(a: AIAnalysis) -> ResumeAnalysisOut:
    r = a.result
    return ResumeAnalysisOut(
        analysis_id=a.id,
        candidate_id=a.candidate_id,
        provider=a.provider,
        model=a.model,
        is_confirmed=a.is_confirmed,
        filename=r["file"]["filename"],
        pages=r["file"]["pages"],
        text_chars=r["text_chars"],
        extraction=ResumeExtraction.model_validate(r["extraction"]),
        warnings=r["warnings"],
        created_at=a.created_at,
    )


def _public_result(a: AIAnalysis) -> dict[str, Any]:
    result = dict(a.result)
    result.pop("source_text", None)
    f = result.get("file")
    if isinstance(f, dict):
        result["file"] = {k: v for k, v in f.items() if k != "storage_key"}
    return result


def _analysis_out(a: AIAnalysis) -> AnalysisOut:
    return AnalysisOut(
        id=a.id,
        kind=a.kind,
        candidate_id=a.candidate_id,
        job_id=a.job_id,
        provider=a.provider,
        model=a.model,
        is_confirmed=a.is_confirmed,
        created_at=a.created_at,
        result=_public_result(a),
    )


# ---------- resume analysis ----------


def analyze_resume(
    db: Session, user: User, candidate_id: uuid.UUID, upload: UploadFile
) -> ResumeAnalysisOut:
    ws = user.workspace_id
    candidate = require(candidate_repo.get(db, ws, candidate_id), "Candidate")

    filename = upload.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise UnprocessableError("Only .pdf files are accepted")
    limit = get_settings().max_resume_bytes
    data = upload.file.read(limit + 1)
    if len(data) > limit:
        raise PayloadTooLargeError(f"Resume must be {limit // 1_000_000} MB or smaller")
    if not data:
        raise UnprocessableError("The file is empty")
    try:
        text, pages = extract_pdf_text(data)
    except PdfError as exc:
        raise UnprocessableError(str(exc)) from None

    outcome = resume_parser.extract_resume(text)

    storage = get_storage()
    key = storage.save(ws, data)
    analysis = AIAnalysis(
        workspace_id=ws,
        candidate_id=candidate.id,
        kind=AIAnalysisKind.RESUME_ANALYSIS,
        provider=outcome.provider,
        model=outcome.model,
        is_confirmed=False,
        created_by_id=user.id,
        result={
            "extraction": outcome.extraction.model_dump(mode="json"),
            "warnings": outcome.warnings,
            "file": {
                "storage_key": key,
                "filename": _display_name(filename),
                "size_bytes": len(data),
                "pages": pages,
            },
            "text_chars": len(text),
            "source_text": text,
        },
    )
    try:
        db.add(analysis)
        db.flush()
        log_activity(
            db,
            workspace_id=ws,
            actor_id=user.id,
            action="candidate.resume_analyzed",
            entity_type="candidate",
            entity_id=candidate.id,
            candidate_id=candidate.id,
            details={"provider": outcome.provider},
        )
        db.commit()
    except Exception:
        db.rollback()
        storage.delete(key)
        raise
    db.refresh(analysis)
    return _resume_out(analysis)


def confirm_resume(
    db: Session, user: User, analysis_id: uuid.UUID, profile: ConfirmedProfile
) -> Candidate:
    ws = user.workspace_id
    analysis = require(ai_repo.get(db, ws, analysis_id, lock=True), "Analysis")
    if analysis.kind != AIAnalysisKind.RESUME_ANALYSIS:
        raise NotFoundError("Analysis not found")
    if analysis.is_confirmed:
        raise ConflictError("This analysis has already been confirmed")
    candidate = require(candidate_repo.get(db, ws, analysis.candidate_id), "Candidate")

    file_info = analysis.result.get("file") or {}
    old_key = candidate.resume_storage_key

    candidate.skills = list(profile.skills)
    if profile.years_experience is not None:
        candidate.years_experience = profile.years_experience
    if profile.summary:
        candidate.experience_summary = profile.summary
    if profile.education:
        candidate.education = [e.model_dump() for e in profile.education]
    candidate.resume_filename = file_info.get("filename")
    candidate.resume_storage_key = file_info.get("storage_key")
    candidate.resume_text = analysis.result.get("source_text")

    analysis.result = {**analysis.result, "confirmed_profile": profile.model_dump(mode="json")}
    analysis.is_confirmed = True
    # Cached scores were computed from the old profile.
    db.execute(
        update(Application)
        .where(Application.workspace_id == ws, Application.candidate_id == candidate.id)
        .values(match_score=None)
    )
    log_activity(
        db,
        workspace_id=ws,
        actor_id=user.id,
        action="candidate.resume_confirmed",
        entity_type="candidate",
        entity_id=candidate.id,
        candidate_id=candidate.id,
    )
    db.commit()
    if old_key and old_key != candidate.resume_storage_key:
        get_storage().delete(old_key)
    return candidate


# ---------- matching ----------


def run_match(db: Session, user: User, candidate_id: uuid.UUID, job_id: uuid.UUID) -> MatchOut:
    ws = user.workspace_id
    candidate = require(candidate_repo.get(db, ws, candidate_id), "Candidate")
    job = require(job_repo.get(db, ws, job_id), "Job")

    detail = matcher.compute_match(
        CandidateInput(
            skills=list(candidate.skills),
            years_experience=float(candidate.years_experience)
            if candidate.years_experience is not None
            else None,
            resume_text=candidate.resume_text,
            summary=candidate.experience_summary,
            current_title=candidate.current_title,
        ),
        JobInput(
            title=job.title,
            description=job.description,
            required_skills=list(job.required_skills),
            preferred_skills=list(job.preferred_skills),
            min_experience=float(job.min_experience) if job.min_experience is not None else None,
            max_experience=float(job.max_experience) if job.max_experience is not None else None,
        ),
        matcher.weights_from_settings(),
    )

    application = db.scalar(
        select(Application).where(
            Application.workspace_id == ws,
            Application.candidate_id == candidate.id,
            Application.job_id == job.id,
        )
    )
    analysis = AIAnalysis(
        workspace_id=ws,
        candidate_id=candidate.id,
        job_id=job.id,
        kind=AIAnalysisKind.JOB_MATCH,
        provider="deterministic",
        result=detail.model_dump(mode="json"),
        created_by_id=user.id,
    )
    db.add(analysis)
    if application is not None:
        application.match_score = detail.score
    db.flush()
    log_activity(
        db,
        workspace_id=ws,
        actor_id=user.id,
        action="ai.match_run",
        entity_type="candidate",
        entity_id=candidate.id,
        candidate_id=candidate.id,
        details={"job_title": job.title, "score": detail.score},
    )
    db.commit()
    db.refresh(analysis)
    return MatchOut(
        **detail.model_dump(),
        analysis_id=analysis.id,
        candidate_id=candidate.id,
        job_id=job.id,
        application_id=application.id if application else None,
        created_at=analysis.created_at,
    )


# ---------- interview questions ----------


def generate_interview_questions(
    db: Session, user: User, req: InterviewQuestionsRequest
) -> InterviewQuestionsOut:
    ws = user.workspace_id
    candidate = require(candidate_repo.get(db, ws, req.candidate_id), "Candidate")
    job = require(job_repo.get(db, ws, req.job_id), "Job")
    outcome = interview_generator.generate(
        JobInput(
            title=job.title,
            description=job.description,
            required_skills=list(job.required_skills),
            preferred_skills=list(job.preferred_skills),
        ),
        CandidateInput(
            skills=list(candidate.skills),
            years_experience=float(candidate.years_experience)
            if candidate.years_experience is not None
            else None,
        ),
        req,
    )
    return InterviewQuestionsOut(
        candidate_id=candidate.id,
        job_id=job.id,
        provider=outcome.provider,
        model=outcome.model,
        questions=outcome.questions,
        warnings=outcome.warnings,
        disclaimer=interview_generator.DISCLAIMER,
    )


def save_questions(db: Session, user: User, req: SaveQuestionsRequest) -> AnalysisOut:
    ws = user.workspace_id
    candidate = require(candidate_repo.get(db, ws, req.candidate_id), "Candidate")
    job = require(job_repo.get(db, ws, req.job_id), "Job")
    analysis = AIAnalysis(
        workspace_id=ws,
        candidate_id=candidate.id,
        job_id=job.id,
        kind=AIAnalysisKind.INTERVIEW_QUESTIONS,
        provider=req.provider,
        is_confirmed=True,
        created_by_id=user.id,
        result={"questions": [q.model_dump(mode="json") for q in req.questions]},
    )
    db.add(analysis)
    db.flush()
    log_activity(
        db,
        workspace_id=ws,
        actor_id=user.id,
        action="ai.questions_saved",
        entity_type="candidate",
        entity_id=candidate.id,
        candidate_id=candidate.id,
        details={"job_title": job.title, "count": len(req.questions)},
    )
    db.commit()
    db.refresh(analysis)
    return _analysis_out(analysis)


def list_analyses(
    db: Session,
    user: User,
    candidate_id: uuid.UUID,
    kind: AIAnalysisKind | None,
    job_id: uuid.UUID | None,
    limit: int,
) -> list[AnalysisOut]:
    require(candidate_repo.get(db, user.workspace_id, candidate_id), "Candidate")
    rows = ai_repo.list_for_candidate(
        db, user.workspace_id, candidate_id, kind=kind, job_id=job_id, limit=limit
    )
    return [_analysis_out(a) for a in rows]
