import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field

from app.models.enums import InterviewStatus, InterviewType


def _check_link(v: str | None) -> str | None:
    if v is None or not v.strip():
        return None
    v = v.strip()
    if not v.lower().startswith(("http://", "https://")):
        raise ValueError("meeting_link must start with http:// or https://")
    return v


MeetingLink = Annotated[str | None, AfterValidator(_check_link)]


class InterviewCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    application_id: uuid.UUID
    interviewer_name: str = Field(min_length=1, max_length=120)
    interviewer_id: uuid.UUID | None = None
    interview_type: InterviewType = InterviewType.TECHNICAL
    scheduled_at: AwareDatetime  # timezone required; naive datetimes are rejected
    duration_minutes: int = Field(45, ge=5, le=480)
    meeting_link: MeetingLink = Field(None, max_length=500)
    notes: str | None = Field(None, max_length=5000)


class InterviewUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    interviewer_name: str | None = Field(None, min_length=1, max_length=120)
    interviewer_id: uuid.UUID | None = None
    interview_type: InterviewType | None = None
    status: InterviewStatus | None = None
    scheduled_at: AwareDatetime | None = None
    duration_minutes: int | None = Field(None, ge=5, le=480)
    meeting_link: MeetingLink = Field(None, max_length=500)
    notes: str | None = Field(None, max_length=5000)


class InterviewOut(BaseModel):
    id: uuid.UUID
    application_id: uuid.UUID
    candidate_id: uuid.UUID
    candidate_name: str
    job_title: str
    interviewer_id: uuid.UUID | None
    interviewer_name: str
    interview_type: InterviewType
    status: InterviewStatus
    scheduled_at: datetime
    duration_minutes: int
    meeting_link: str | None
    notes: str | None
    created_at: datetime


def interview_out(row: Any) -> InterviewOut:
    i, candidate_id, candidate_name, job_title = row
    return InterviewOut(
        id=i.id,
        application_id=i.application_id,
        candidate_id=candidate_id,
        candidate_name=candidate_name,
        job_title=job_title,
        interviewer_id=i.interviewer_id,
        interviewer_name=i.interviewer_name,
        interview_type=i.interview_type,
        status=i.status,
        scheduled_at=i.scheduled_at,
        duration_minutes=i.duration_minutes,
        meeting_link=i.meeting_link,
        notes=i.notes,
        created_at=i.created_at,
    )
