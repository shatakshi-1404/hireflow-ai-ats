import io
import uuid

import pytest
from botocore.exceptions import ClientError

from app.core.config import Settings
from app.core.errors import ServiceUnavailableError
from app.core.storage import S3Storage

WS = uuid.uuid4()


class FakeS3:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}
        self.fail = False

    def _err(self, code: str, op: str) -> ClientError:
        return ClientError({"Error": {"Code": code, "Message": "x"}}, op)

    def put_object(self, *, Bucket, Key, Body, ContentType):
        if self.fail:
            raise self._err("500", "PutObject")
        self.objects[Key] = Body

    def get_object(self, *, Bucket, Key):
        if self.fail:
            raise self._err("500", "GetObject")
        if Key not in self.objects:
            raise self._err("NoSuchKey", "GetObject")
        return {"Body": io.BytesIO(self.objects[Key])}

    def delete_object(self, *, Bucket, Key):
        if self.fail:
            raise self._err("500", "DeleteObject")
        self.objects.pop(Key, None)


def test_database_urls_from_hosts_are_normalised():
    for raw in ("postgres://u:p@h/d?sslmode=require", "postgresql://u:p@h/d?sslmode=require"):
        s = Settings(database_url=raw, secret_key="test-secret")
        assert s.database_url == "postgresql+psycopg://u:p@h/d?sslmode=require"
    explicit = "postgresql+psycopg://u:p@h/d"
    assert Settings(database_url=explicit, secret_key="test-secret").database_url == explicit


def test_s3_backend_requires_its_settings():
    with pytest.raises(ValueError, match="S3_BUCKET"):
        Settings(database_url="postgresql://u:p@h/d", secret_key="test-secret", storage_backend="s3")


def test_s3_storage_round_trip_and_missing_file():
    fake = FakeS3()
    storage = S3Storage(fake, "bucket")
    key = storage.save(WS, b"%PDF-data")
    assert key.startswith(f"{WS}/") and key.endswith(".pdf")
    assert storage.read(key) == b"%PDF-data"
    storage.delete(key)
    with pytest.raises(FileNotFoundError):
        storage.read(key)


def test_s3_storage_rejects_malformed_keys():
    storage = S3Storage(FakeS3(), "bucket")
    for bad in ("../../etc/passwd", "/abs.pdf", "x/y.pdf", f"{WS}/../other.pdf", ""):
        with pytest.raises(ValueError):
            storage.read(bad)
        with pytest.raises(ValueError):
            storage.delete(bad)


def test_s3_failures_become_503_but_delete_never_raises():
    fake = FakeS3()
    storage = S3Storage(fake, "bucket")
    key = storage.save(WS, b"x")
    fake.fail = True
    with pytest.raises(ServiceUnavailableError):
        storage.save(WS, b"x")
    with pytest.raises(ServiceUnavailableError):
        storage.read(key)
    storage.delete(key)  # swallowed and logged
