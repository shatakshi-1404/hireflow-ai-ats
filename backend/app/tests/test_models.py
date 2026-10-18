import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://x:x@localhost:5433/x")
os.environ.setdefault("SECRET_KEY", "test-secret")

import app.models  # noqa: E402,F401
from app.db.base import Base  # noqa: E402

EXPECTED_TABLES = {
    "workspaces",
    "users",
    "candidates",
    "candidate_notes",
    "jobs",
    "applications",
    "stage_history",
    "interviews",
    "activity_logs",
    "ai_analyses",
}


def test_all_tables_registered():
    assert EXPECTED_TABLES <= set(Base.metadata.tables)


def test_application_unique_per_candidate_and_job():
    table = Base.metadata.tables["applications"]
    uniques = {c.name for c in table.constraints if c.__class__.__name__ == "UniqueConstraint"}
    assert "uq_applications_candidate_job" in uniques


def test_every_tenant_table_has_workspace_id():
    tenant_tables = EXPECTED_TABLES - {"workspaces"}
    for name in tenant_tables:
        assert "workspace_id" in Base.metadata.tables[name].c, name
