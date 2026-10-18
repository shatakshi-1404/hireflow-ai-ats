from pydantic import BaseModel


class ImportRowError(BaseModel):
    row: int  # spreadsheet row number (header is row 1)
    email: str | None
    error: str


class ImportResult(BaseModel):
    total_rows: int
    created: int
    skipped: int
    dry_run: bool
    errors: list[ImportRowError]
