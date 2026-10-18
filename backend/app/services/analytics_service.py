import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.dates import to_utc_range
from app.core.errors import UnprocessableError
from app.models.enums import ApplicationStage as S
from app.repositories import analytics as repo
from app.schemas.analytics import (
    METRIC_DEFINITIONS,
    FunnelStep,
    Granularity,
    Kpis,
    OverviewOut,
    PipelineOut,
    RecentActivity,
    StageCount,
    TimePoint,
)

FUNNEL = [S.APPLIED, S.SCREENING, S.SHORTLISTED, S.INTERVIEW, S.OFFER, S.HIRED]
MAX_BUCKETS = 400
DEFAULT_WINDOW_DAYS = 90


def _align(d: date, granularity: str) -> date:
    if granularity == "week":
        return d - timedelta(days=d.weekday())  # Monday, matching date_trunc('week')
    if granularity == "month":
        return d.replace(day=1)
    return d


def _next(d: date, granularity: str) -> date:
    if granularity == "day":
        return d + timedelta(days=1)
    if granularity == "week":
        return d + timedelta(days=7)
    return date(d.year + 1, 1, 1) if d.month == 12 else date(d.year, d.month + 1, 1)


def _ratio(num: int, den: int) -> float | None:
    return round(num / den, 4) if den > 0 else None


def overview(
    db: Session,
    workspace_id: uuid.UUID,
    date_from: date | None,
    date_to: date | None,
    granularity: Granularity,
) -> OverviewOut:
    now = datetime.now(UTC)
    end_d = date_to or now.date()
    start_d = date_from or (end_d - timedelta(days=DEFAULT_WINDOW_DAYS - 1))
    start_dt, end_dt = to_utc_range(start_d, end_d)
    assert start_dt and end_dt

    buckets: list[date] = []
    cur = _align(start_d, granularity)
    while cur <= end_d:
        buckets.append(cur)
        if len(buckets) > MAX_BUCKETS:
            raise UnprocessableError("Date range is too large for this granularity")
        cur = _next(cur, granularity)

    counts = repo.applications_per_bucket(db, workspace_id, granularity, start_dt, end_dt)
    activity = [
        RecentActivity(
            id=a.id,
            action=a.action,
            entity_type=a.entity_type,
            actor_name=actor,
            candidate_name=cand,
            details=a.details,
            created_at=a.created_at,
        )
        for a, actor, cand in repo.recent_activity(db, workspace_id)
    ]
    return OverviewOut(
        kpis=Kpis(**repo.kpis(db, workspace_id, now)),
        granularity=granularity,
        date_from=start_d,
        date_to=end_d,
        applications_over_time=[TimePoint(period=b, count=counts.get(b, 0)) for b in buckets],
        recent_activity=activity,
        definitions=METRIC_DEFINITIONS,
    )


def pipeline(
    db: Session, workspace_id: uuid.UUID, date_from: date | None, date_to: date | None
) -> PipelineOut:
    start, end = to_utc_range(date_from, date_to)
    dist = repo.stage_distribution(db, workspace_id, start, end)
    reached = repo.reached_counts(db, workspace_id, start, end)

    funnel: list[FunnelStep] = []
    first = reached.get(FUNNEL[0], 0)
    prev: int | None = None
    for stage in FUNNEL:
        n = reached.get(stage, 0)
        funnel.append(
            FunnelStep(
                stage=stage,
                reached=n,
                conversion_from_previous=None if prev is None else _ratio(n, prev),
                conversion_from_start=None if stage == FUNNEL[0] else _ratio(n, first),
            )
        )
        prev = n
    return PipelineOut(
        date_from=date_from,
        date_to=date_to,
        cohort_size=repo.cohort_size(db, workspace_id, start, end),
        stage_distribution=[StageCount(stage=s, count=dist.get(s, 0)) for s in S],
        funnel=funnel,
        definitions=METRIC_DEFINITIONS,
    )
