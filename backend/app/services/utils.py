from typing import Any

from app.core.errors import UnprocessableError


def reject_nulls(changes: dict[str, Any], required: tuple[str, ...]) -> None:
    for field in required:
        if field in changes and changes[field] is None:
            raise UnprocessableError(f"{field} cannot be null")
