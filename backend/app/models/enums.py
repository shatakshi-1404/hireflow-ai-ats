import enum

from sqlalchemy import Enum as SAEnum


def pg_enum(cls: type[enum.Enum]) -> SAEnum:
    """String-backed enum (no native PG enum type, so migrations stay simple)."""
    return SAEnum(cls, native_enum=False, length=30, validate_strings=True)


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    RECRUITER = "RECRUITER"
    VIEWER = "VIEWER"


class EmploymentType(str, enum.Enum):
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    CONTRACT = "CONTRACT"
    INTERNSHIP = "INTERNSHIP"


class JobStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    ON_HOLD = "ON_HOLD"
    CLOSED = "CLOSED"


class ApplicationStage(str, enum.Enum):
    APPLIED = "APPLIED"
    SCREENING = "SCREENING"
    SHORTLISTED = "SHORTLISTED"
    INTERVIEW = "INTERVIEW"
    OFFER = "OFFER"
    HIRED = "HIRED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class InterviewType(str, enum.Enum):
    TECHNICAL = "TECHNICAL"
    BEHAVIORAL = "BEHAVIORAL"
    HR = "HR"
    PANEL = "PANEL"
    OTHER = "OTHER"


class InterviewStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class AIAnalysisKind(str, enum.Enum):
    RESUME_ANALYSIS = "RESUME_ANALYSIS"
    JOB_MATCH = "JOB_MATCH"
    INTERVIEW_QUESTIONS = "INTERVIEW_QUESTIONS"
