from datetime import UTC, date, datetime, time, timedelta

from app.core.errors import UnprocessableError


def to_utc_range(
    date_from: date | None, date_to: date | None
) -> tuple[datetime | None, datetime | None]:
    """Inclusive calendar dates -> half-open UTC datetime range [start, end)."""
    if date_from and date_to and date_from > date_to:
        raise UnprocessableError("date_from must be on or before date_to")
    start = datetime.combine(date_from, time.min, UTC) if date_from else None
    end = datetime.combine(date_to + timedelta(days=1), time.min, UTC) if date_to else None
    return start, end
