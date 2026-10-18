import os
import tempfile

# Must be set before the app is imported: tests never touch the dev database.
os.environ["DATABASE_URL"] = (
    "postgresql+psycopg://hireflow:hireflow_dev_password@localhost:5433/hireflow_test"
)
os.environ["SECRET_KEY"] = "test-secret-key-for-pytest-only-0123456789"
os.environ["ENVIRONMENT"] = "test"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="hireflow-test-uploads-")
os.environ["AI_PROVIDER"] = "none"

import email_validator  # noqa: E402

email_validator.TEST_ENVIRONMENT = True  # allow reserved .test domains in tests only

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import app.models  # noqa: E402,F401
from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.tests.helpers import signup  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    assert engine.url.database and engine.url.database.endswith("_test"), "refusing to run"
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _clean_tables():
    yield
    names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


@pytest.fixture
def make_client():
    """Factory for independent clients (each has its own cookie jar)."""
    clients: list[TestClient] = []

    def _make() -> TestClient:
        c = TestClient(app)
        clients.append(c)
        return c

    yield _make
    for c in clients:
        c.close()


@pytest.fixture
def admin(make_client) -> TestClient:
    c = make_client()
    signup(c)
    return c


@pytest.fixture
def other_admin(make_client) -> TestClient:
    c = make_client()
    signup(c, "admin@globex.test", "Globex")
    return c
