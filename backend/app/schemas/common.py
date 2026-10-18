from math import ceil
from typing import Annotated, Any, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, BeforeValidator, Field

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


def make_page(items: list[Any], total: int, page: int, page_size: int) -> dict[str, Any]:
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, ceil(total / page_size)),
    }


def _opt_float(v: Any) -> float | None:
    return None if v is None else float(v)


# Numeric columns come back as Decimal; expose them as plain JSON numbers.
OptFloat = Annotated[float | None, BeforeValidator(_opt_float)]


def normalize_skills(values: list[str]) -> list[str]:
    out: dict[str, None] = {}
    for raw in values:
        skill = " ".join(raw.split()).lower()
        if not skill:
            continue
        if len(skill) > 60:
            raise ValueError("Each skill must be 60 characters or fewer")
        out.setdefault(skill)
    return list(out)


SkillList = Annotated[list[str], Field(max_length=100), AfterValidator(normalize_skills)]
