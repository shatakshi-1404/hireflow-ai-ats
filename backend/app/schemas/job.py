import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import EmploymentType, JobStatus
from app.schemas.common import OptFloat, SkillList


class JobCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=160)
    department: str | None = Field(None, max_length=80)
    location: str | None = Field(None, max_length=120)
    employment_type: EmploymentType = EmploymentType.FULL_TIME
    description: str = Field(min_length=1, max_length=10000)
    required_skills: SkillList = Field(default_factory=list)
    preferred_skills: SkillList = Field(default_factory=list)
    min_experience: float | None = Field(None, ge=0, le=60)
    max_experience: float | None = Field(None, ge=0, le=60)
    status: JobStatus = JobStatus.OPEN

    @model_validator(mode="after")
    def _check_range(self) -> "JobCreate":
        lo, hi = self.min_experience, self.max_experience
        if lo is not None and hi is not None and hi < lo:
            raise ValueError("max_experience must be greater than or equal to min_experience")
        return self


class JobUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(None, min_length=1, max_length=160)
    department: str | None = Field(None, max_length=80)
    location: str | None = Field(None, max_length=120)
    employment_type: EmploymentType | None = None
    description: str | None = Field(None, min_length=1, max_length=10000)
    required_skills: SkillList | None = None
    preferred_skills: SkillList | None = None
    min_experience: float | None = Field(None, ge=0, le=60)
    max_experience: float | None = Field(None, ge=0, le=60)
    status: JobStatus | None = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    department: str | None
    location: str | None
    employment_type: EmploymentType
    description: str
    required_skills: list[str]
    preferred_skills: list[str]
    min_experience: OptFloat
    max_experience: OptFloat
    status: JobStatus
    closed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    applicant_count: int = 0


class JobDetailOut(JobOut):
    stage_counts: dict[str, int] = Field(default_factory=dict)
