import logging
import re
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any

from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import get_settings
from app.core.errors import ServiceUnavailableError

log = logging.getLogger(__name__)

_KEY = re.compile(r"[0-9a-f-]{36}/[0-9a-f]{32}\.pdf")


class LocalStorage:
    """Private local file storage. Keys are server-generated; user filenames never touch the filesystem."""

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()

    def _path(self, key: str) -> Path:
        if "\\" in key or "\x00" in key:
            raise ValueError("Invalid storage key")
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError("Invalid storage key")
        return path

    def save(self, workspace_id: uuid.UUID, data: bytes) -> str:
        key = f"{workspace_id}/{uuid.uuid4().hex}.pdf"
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)


class S3Storage:
    """Private S3-compatible bucket (Cloudflare R2, S3, MinIO). The bucket is never public.
    Files are only served through authenticated API routes."""

    def __init__(self, client: Any, bucket: str) -> None:
        self.client = client
        self.bucket = bucket

    @staticmethod
    def _check(key: str) -> None:
        if not _KEY.fullmatch(key):
            raise ValueError("Invalid storage key")

    def save(self, workspace_id: uuid.UUID, data: bytes) -> str:
        key = f"{workspace_id}/{uuid.uuid4().hex}.pdf"
        try:
            self.client.put_object(
                Bucket=self.bucket, Key=key, Body=data, ContentType="application/pdf"
            )
        except (ClientError, BotoCoreError) as exc:
            log.error("object storage save failed: %s", type(exc).__name__)
            raise ServiceUnavailableError("File storage is unavailable. Please try again later.") from None
        return key

    def read(self, key: str) -> bytes:
        self._check(key)
        try:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404", "NotFound"}:
                raise FileNotFoundError(key) from None
            log.error("object storage read failed: %s", type(exc).__name__)
            raise ServiceUnavailableError("File storage is unavailable. Please try again later.") from None
        except BotoCoreError as exc:
            log.error("object storage read failed: %s", type(exc).__name__)
            raise ServiceUnavailableError("File storage is unavailable. Please try again later.") from None

    def delete(self, key: str) -> None:
        self._check(key)
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except (ClientError, BotoCoreError) as exc:
            # An orphaned file is better than failing a request whose database change already committed.
            log.warning("object storage delete failed: %s", type(exc).__name__)


@lru_cache
def get_storage() -> LocalStorage | S3Storage:
    s = get_settings()
    if s.storage_backend == "s3":
        import boto3
        from botocore.config import Config

        client = boto3.client(
            "s3",
            endpoint_url=s.s3_endpoint_url,
            aws_access_key_id=s.s3_access_key_id,
            aws_secret_access_key=s.s3_secret_access_key,
            region_name=s.s3_region,
            config=Config(
                signature_version="s3v4",
                connect_timeout=5,
                read_timeout=20,
                retries={"max_attempts": 2, "mode": "standard"},
            ),
        )
        return S3Storage(client, s.s3_bucket)
    return LocalStorage(Path(s.upload_dir))
