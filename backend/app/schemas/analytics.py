import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.models.enums import ApplicationStage

Granularity = Literal["day", "week", "month"]

METRIC_DEFINITIONS = {
    "total_candidates": "Non-archived candidates in the workspace (current snapshot).",
    "active_jobs": "Jobs with status OPEN (current snapshot).",
    "active_applications": "Applications currently in Applied, Screening, Shortlisted, Interview or Offer.",
    "upcoming_interviews": "Interviews with status SCHEDULED and a start time in the future.",
    "offers": "Applications currently in the Offer stage. An offer is not a hire.",
    "hires": "Applications currently in the Hired stage.",
    "applications_over_time": "Applications created per period (UTC), by applied date, within the date range.",
    "funnel": "Distinct applications that ever reached each stage (from stage history), for applications created in the date range.",
    "conversion": "Reached at stage N divided by reached at stage N-1. Empty when the previous count is 0.",
}


class Kpis(BaseModel):
    total_candidates: int
    active_jobs: int
    active_applications: int
    upcoming_interviews: int
    offers: int
    hires: int


class TimePoint(BaseModel):
    period: date
    count: int


class RecentActivity(BaseModel):
    id: uuid.UUID
    action: str
    entity_type: str
    actor_name: str | None
    candidate_name: str | None
    details: dict[str, Any] | None
    created_at: datetime


class OverviewOut(BaseModel):
    kpis: Kpis
    granularity: Granularity
    date_from: date
    date_to: date
    applications_over_time: list[TimePoint]
    recent_activity: list[RecentActivity]
    definitions: dict[str, str]


class StageCount(BaseModel):
    stage: ApplicationStage
    count: int


class FunnelStep(BaseModel):
    stage: ApplicationStage
    reached: int
    conversion_from_previous: float | None
    conversion_from_start: float | None


class PipelineOut(BaseModel):
    date_from: date | None
    date_to: date | None
    cohort_size: int
    stage_distribution: list[StageCount]
    funnel: list[FunnelStep]
    definitions: dict[str, str]
