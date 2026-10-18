import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AIAnalysis
from app.models.enums import AIAnalysisKind


def get(
    db: Session, workspace_id: uuid.UUID, analysis_id: uuid.UUID, *, lock: bool = False
) -> AIAnalysis | None:
    stmt = select(AIAnalysis).where(
        AIAnalysis.id == analysis_id, AIAnalysis.workspace_id == workspace_id
    )
    if lock:
        stmt = stmt.with_for_update()
    return db.scalar(stmt)


def list_for_candidate(
    db: Session,
    workspace_id: uuid.UUID,
    candidate_id: uuid.UUID,
    *,
    kind: AIAnalysisKind | None = None,
    job_id: uuid.UUID | None = None,
    limit: int = 20,
) -> list[AIAnalysis]:
    conds = [AIAnalysis.workspace_id == workspace_id, AIAnalysis.candidate_id == candidate_id]
    if kind:
        conds.append(AIAnalysis.kind == kind)
    if job_id:
        conds.append(AIAnalysis.job_id == job_id)
    return list(
        db.scalars(
            select(AIAnalysis).where(*conds).order_by(AIAnalysis.created_at.desc()).limit(limit)
        )
    )


def resume_file_keys(db: Session, workspace_id: uuid.UUID, candidate_id: uuid.UUID) -> list[str]:
    key = AIAnalysis.result["file"]["storage_key"].as_string()
    rows = db.scalars(
        select(key).where(
            AIAnalysis.workspace_id == workspace_id,
            AIAnalysis.candidate_id == candidate_id,
            AIAnalysis.kind == AIAnalysisKind.RESUME_ANALYSIS,
        )
    )
    return [k for k in rows if k]
