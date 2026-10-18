import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import AIAnalysisKind
from app.schemas.candidate import EducationItem
from app.schemas.common import SkillList

# ---------- shared inputs (deliberately no name / email / photo / demographic fields) ----------


class JobInput(BaseModel):
    title: str
    description: str
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    min_experience: float | None = None
    max_experience: float | None = None


class CandidateInput(BaseModel):
    skills: list[str] = Field(default_factory=list)
    years_experience: float | None = None
    resume_text: str | None = None
    summary: str | None = None
    current_title: str | None = None


# ---------- resume analysis ----------


class ExtractedEducation(BaseModel):
    institution: str | None = Field(None, max_length=160)
    degree: str | None = Field(None, max_length=120)
    field_of_study: str | None = Field(None, max_length=120)
    year: int | None = Field(None, ge=1950, le=2100)
    evidence: str | None = Field(None, max_length=300)


class WorkItem(BaseModel):
    title: str | None = Field(None, max_length=160)
    company: str | None = Field(None, max_length=160)
    period: str | None = Field(None, max_length=80)
    description: str | None = Field(None, max_length=1500)


class ProjectItem(BaseModel):
    name: str | None = Field(None, max_length=160)
    description: str | None = Field(None, max_length=1500)
    technologies: list[Annotated[str, Field(max_length=60)]] = Field(
        default_factory=list, max_length=20
    )


class ResumeExtraction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    skills: list[str] = Field(default_factory=list, max_length=100)
    years_experience: float | None = Field(None, ge=0, le=60)
    years_experience_evidence: str | None = Field(None, max_length=300)
    summary: str | None = Field(None, max_length=1500)
    education: list[ExtractedEducation] = Field(default_factory=list, max_length=10)
    work_experience: list[WorkItem] = Field(default_factory=list, max_length=30)
    projects: list[ProjectItem] = Field(default_factory=list, max_length=30)
    uncertainties: list[str] = Field(default_factory=list, max_length=15)
    skill_evidence: dict[str, str] = Field(default_factory=dict)  # computed server-side


class ResumeAnalysisOut(BaseModel):
    analysis_id: uuid.UUID
    candidate_id: uuid.UUID
    provider: str
    model: str | None
    is_confirmed: bool
    filename: str
    pages: int
    text_chars: int
    extraction: ResumeExtraction
    warnings: list[str]
    created_at: datetime


class ConfirmedProfile(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    skills: SkillList = Field(default_factory=list)
    years_experience: float | None = Field(None, ge=0, le=60)
    summary: str | None = Field(None, max_length=5000)
    education: list[EducationItem] = Field(default_factory=list, max_length=20)
    work_experience: list[WorkItem] = Field(default_factory=list, max_length=30)
    projects: list[ProjectItem] = Field(default_factory=list, max_length=30)


# ---------- matching ----------


class MatchRequest(BaseModel):
    candidate_id: uuid.UUID
    job_id: uuid.UUID


class SkillEvidence(BaseModel):
    skill: str
    source: Literal["resume", "profile"]
    evidence: str | None = None


class UnverifiedSkill(BaseModel):
    skill: str
    note: str


class MatchComponent(BaseModel):
    key: str
    label: str
    value: float | None  # 0..1, None when it could not be assessed
    weight: float  # effective weight after renormalising over assessable components
    detail: str


class ExperienceEvidence(BaseModel):
    candidate_years: float | None
    job_min: float | None
    job_max: float | None
    fit: float | None
    note: str


class MatchDetail(BaseModel):
    provider: Literal["deterministic"] = "deterministic"
    score: float | None
    components: list[MatchComponent]
    matched_required: list[SkillEvidence]
    matched_preferred: list[SkillEvidence]
    unverified_required: list[UnverifiedSkill]
    unverified_preferred: list[UnverifiedSkill]
    experience: ExperienceEvidence
    method: str
    warnings: list[str]
    disclaimer: str


class MatchOut(MatchDetail):
    analysis_id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    application_id: uuid.UUID | None
    created_at: datetime


# ---------- interview questions ----------

Difficulty = Literal["easy", "medium", "hard"]


class InterviewQuestion(BaseModel):
    question: str = Field(min_length=5, max_length=600)
    category: Literal["technical", "behavioral"]
    difficulty: Difficulty
    competencies: list[Annotated[str, Field(max_length=80)]] = Field(
        default_factory=list, max_length=6
    )
    evaluation_criteria: list[Annotated[str, Field(min_length=1, max_length=300)]] = Field(
        min_length=1, max_length=6
    )
    follow_up: str | None = Field(None, max_length=400)


class InterviewQuestionsRequest(BaseModel):
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    duration_minutes: int = Field(45, ge=15, le=180)
    difficulty: Difficulty = "medium"
    category: Literal["technical", "behavioral", "mixed"] = "mixed"
    variant: int = Field(0, ge=0, le=1000)  # bump to "regenerate" template questions


class InterviewQuestionsOut(BaseModel):
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    provider: str
    model: str | None
    questions: list[InterviewQuestion]
    warnings: list[str]
    disclaimer: str


class SaveQuestionsRequest(BaseModel):
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    provider: Literal["template", "anthropic", "openai"]
    questions: list[InterviewQuestion] = Field(min_length=1, max_length=30)


# ---------- generic ----------


class AnalysisOut(BaseModel):
    id: uuid.UUID
    kind: AIAnalysisKind
    candidate_id: uuid.UUID
    job_id: uuid.UUID | None
    provider: str
    model: str | None
    is_confirmed: bool
    created_at: datetime
    result: dict[str, Any]
