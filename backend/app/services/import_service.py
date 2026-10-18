import csv
import io
import re

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, UnprocessableError
from app.models import Candidate, User
from app.schemas.candidate import CandidateCreate
from app.schemas.imports import ImportResult, ImportRowError
from app.services.activity import log_activity

MAX_ROWS = 500
SKILL_SPLIT = re.compile(r"[;|,]")
OPTIONAL_TEXT = ("phone", "current_title", "experience_summary", "source")


def _describe(exc: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()
    )[:300]


def import_candidates(db: Session, user: User, raw: bytes, dry_run: bool) -> ImportResult:
    ws = user.workspace_id
    if b"\x00" in raw:
        raise UnprocessableError("File does not look like a CSV text file")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise UnprocessableError("CSV must be UTF-8 encoded") from None

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise UnprocessableError("CSV is empty")
    reader.fieldnames = [(h or "").strip().lower() for h in reader.fieldnames]
    missing = {"full_name", "email"} - set(reader.fieldnames)
    if missing:
        raise UnprocessableError(f"Missing required column(s): {', '.join(sorted(missing))}")

    existing = set(db.scalars(select(Candidate.email).where(Candidate.workspace_id == ws)))
    seen: set[str] = set()
    valid: list[CandidateCreate] = []
    errors: list[ImportRowError] = []
    total = 0

    try:
        for row_no, raw_row in enumerate(reader, start=2):
            row = {
                k: (v or "").strip()
                for k, v in raw_row.items()
                if k is not None and isinstance(v, str | None)
            }
            if not any(row.values()):
                continue  # blank line
            total += 1
            if total > MAX_ROWS:
                raise UnprocessableError(f"CSV has more than {MAX_ROWS} rows")

            payload: dict = {"full_name": row.get("full_name", ""), "email": row.get("email", "")}
            for field in OPTIONAL_TEXT:
                if row.get(field):
                    payload[field] = row[field]
            if row.get("skills"):
                payload["skills"] = SKILL_SPLIT.split(row["skills"])
            if row.get("years_experience"):
                payload["years_experience"] = row["years_experience"]

            email_shown = row.get("email") or None
            try:
                data = CandidateCreate(**payload)
            except ValidationError as exc:
                errors.append(ImportRowError(row=row_no, email=email_shown, error=_describe(exc)))
                continue
            email = str(data.email).lower()
            if email in existing:
                errors.append(
                    ImportRowError(row=row_no, email=email, error="Already exists in this workspace")
                )
            elif email in seen:
                errors.append(
                    ImportRowError(row=row_no, email=email, error="Duplicate email within the file")
                )
            else:
                seen.add(email)
                valid.append(data)
    except csv.Error as exc:
        raise UnprocessableError(f"Malformed CSV: {exc}") from None

    if not dry_run and valid:
        created: list[Candidate] = []
        for data in valid:
            c = Candidate(
                workspace_id=ws,
                created_by_id=user.id,
                email=str(data.email).lower(),
                **data.model_dump(exclude={"email"}),
            )
            db.add(c)
            created.append(c)
        db.flush()
        for c in created:
            log_activity(
                db,
                workspace_id=ws,
                actor_id=user.id,
                action="candidate.created",
                entity_type="candidate",
                entity_id=c.id,
                candidate_id=c.id,
                details={"via": "csv_import"},
            )
        log_activity(
            db,
            workspace_id=ws,
            actor_id=user.id,
            action="candidate.imported",
            entity_type="candidate",
            details={"count": len(created)},
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise ConflictError("Import conflicted with concurrent changes. Please retry.") from None

    return ImportResult(
        total_rows=total,
        created=0 if dry_run else len(valid),
        skipped=len(errors),
        dry_run=dry_run,
        errors=errors,
    )
