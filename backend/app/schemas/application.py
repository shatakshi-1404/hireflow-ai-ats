import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.workflow import allowed_next
from app.models import Application
from app.models.enums import ApplicationStage
from app.schemas.common import OptFloat


class ApplicationCreate(BaseModel):
    candidate_id: uuid.UUID
    job_id: uuid.UUID


class StageChange(BaseModel):
    to_stage: ApplicationStage
    reason: str | None = Field(None, max_length=1000)


class ApplicationBrief(BaseModel):
    """Used inside the candidate profile."""

    id: uuid.UUID
    job_id: uuid.UUID
    job_title: str
    stage: ApplicationStage
    applied_at: datetime
    match_score: OptFloat = None


class ApplicationOut(BaseModel):
    id: uuid.UUID
    candidate_id: uuid.UUID
    candidate_name: str
    candidate_skills: list[str]
    candidate_years_experience: OptFloat = None
    job_id: uuid.UUID
    job_title: str
    stage: ApplicationStage
    applied_at: datetime
    stage_changed_at: datetime
    match_score: OptFloat = None
    allowed_next_stages: list[ApplicationStage]


class StageHistoryOut(BaseModel):
    id: uuid.UUID
    from_stage: ApplicationStage | None
    to_stage: ApplicationStage
    changed_by_name: str | None
    reason: str | None
    created_at: datetime


def application_out(a: Application) -> ApplicationOut:
    return ApplicationOut(
        id=a.id,
        candidate_id=a.candidate_id,
        candidate_name=a.candidate.full_name,
        candidate_skills=list(a.candidate.skills),
        candidate_years_experience=a.candidate.years_experience,
        job_id=a.job_id,
        job_title=a.job.title,
        stage=a.stage,
        applied_at=a.applied_at,
        stage_changed_at=a.stage_changed_at,
        match_score=a.match_score,
        allowed_next_stages=allowed_next(a.stage),
    )


def application_brief(a: Application) -> ApplicationBrief:
    return ApplicationBrief(
        id=a.id,
        job_id=a.job_id,
        job_title=a.job.title,
        stage=a.stage,
        applied_at=a.applied_at,
        match_score=a.match_score,
    )
