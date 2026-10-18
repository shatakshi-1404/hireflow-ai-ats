import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Form, Query, Request, UploadFile

from app.core.permissions import CurrentUser, WriterUser
from app.core.rate_limit import limiter
from app.db.session import DbSession
from app.models.enums import AIAnalysisKind
from app.schemas.ai import (
    AnalysisOut,
    ConfirmedProfile,
    InterviewQuestionsOut,
    InterviewQuestionsRequest,
    MatchOut,
    MatchRequest,
    ResumeAnalysisOut,
    SaveQuestionsRequest,
)
from app.schemas.candidate import CandidateOut
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status")
def status(user: CurrentUser) -> dict[str, Any]:
    return ai_service.ai_status()


@router.post("/resume-analysis", response_model=ResumeAnalysisOut, status_code=201)
@limiter.limit("10/minute")
def resume_analysis(
    request: Request,
    user: WriterUser,
    db: DbSession,
    candidate_id: Annotated[uuid.UUID, Form()],
    file: UploadFile,
):
    return ai_service.analyze_resume(db, user, candidate_id, file)


@router.post("/resume-analysis/{analysis_id}/confirm", response_model=CandidateOut)
def confirm_resume(
    analysis_id: uuid.UUID, user: WriterUser, db: DbSession, payload: ConfirmedProfile
):
    return CandidateOut.model_validate(ai_service.confirm_resume(db, user, analysis_id, payload))


@router.post("/match", response_model=MatchOut)
@limiter.limit("30/minute")
def match(request: Request, user: WriterUser, db: DbSession, payload: MatchRequest):
    return ai_service.run_match(db, user, payload.candidate_id, payload.job_id)


@router.post("/interview-questions", response_model=InterviewQuestionsOut)
@limiter.limit("20/minute")
def interview_questions(
    request: Request, user: WriterUser, db: DbSession, payload: InterviewQuestionsRequest
):
    return ai_service.generate_interview_questions(db, user, payload)


@router.post("/interview-questions/save", response_model=AnalysisOut, status_code=201)
def save_interview_questions(user: WriterUser, db: DbSession, payload: SaveQuestionsRequest):
    return ai_service.save_questions(db, user, payload)


@router.get("/analyses", response_model=list[AnalysisOut])
def list_analyses(
    user: CurrentUser,
    db: DbSession,
    candidate_id: uuid.UUID,
    kind: AIAnalysisKind | None = None,
    job_id: uuid.UUID | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
):
    return ai_service.list_analyses(db, user, candidate_id, kind, job_id, limit)
