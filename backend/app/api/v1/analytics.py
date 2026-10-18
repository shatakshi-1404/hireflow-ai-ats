from datetime import date

from fastapi import APIRouter

from app.core.permissions import CurrentUser
from app.db.session import DbSession
from app.schemas.analytics import Granularity, OverviewOut, PipelineOut
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewOut)
def overview(
    user: CurrentUser,
    db: DbSession,
    date_from: date | None = None,
    date_to: date | None = None,
    granularity: Granularity = "day",
):
    return analytics_service.overview(db, user.workspace_id, date_from, date_to, granularity)


@router.get("/pipeline", response_model=PipelineOut)
def pipeline(
    user: CurrentUser,
    db: DbSession,
    date_from: date | None = None,
    date_to: date | None = None,
):
    return analytics_service.pipeline(db, user.workspace_id, date_from, date_to)
