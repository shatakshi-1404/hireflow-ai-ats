import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.application import ApplicationBrief
from app.schemas.common import OptFloat, SkillList


class EducationItem(BaseModel):
    institution: str = Field(min_length=1, max_length=160)
    degree: str | None = Field(None, max_length=120)
    field_of_study: str | None = Field(None, max_length=120)
    year: int | None = Field(None, ge=1950, le=2100)


class CandidateCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str | None = Field(None, max_length=32)
    current_title: str | None = Field(None, max_length=120)
    skills: SkillList = Field(default_factory=list)
    years_experience: float | None = Field(None, ge=0, le=60)
    experience_summary: str | None = Field(None, max_length=5000)
    education: list[EducationItem] | None = Field(None, max_length=20)
    source: str | None = Field(None, max_length=60)


class CandidateUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str | None = Field(None, min_length=1, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=32)
    current_title: str | None = Field(None, max_length=120)
    skills: SkillList | None = None
    years_experience: float | None = Field(None, ge=0, le=60)
    experience_summary: str | None = Field(None, max_length=5000)
    education: list[EducationItem] | None = Field(None, max_length=20)
    source: str | None = Field(None, max_length=60)
    is_archived: bool | None = None


class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    current_title: str | None
    skills: list[str]
    years_experience: OptFloat
    experience_summary: str | None
    education: list[dict[str, Any]] | None
    source: str | None
    resume_filename: str | None
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class CandidateDetailOut(CandidateOut):
    applications: list[ApplicationBrief] = Field(default_factory=list)


class NoteCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    body: str = Field(min_length=1, max_length=5000)


class NoteOut(BaseModel):
    id: uuid.UUID
    author_name: str | None
    body: str
    created_at: datetime


class ActivityOut(BaseModel):
    id: uuid.UUID
    action: str
    entity_type: str
    actor_name: str | None
    details: dict[str, Any] | None
    created_at: datetime
