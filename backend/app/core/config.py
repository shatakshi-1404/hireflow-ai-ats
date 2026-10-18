from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "HireFlow AI"
    environment: str = "development"
    database_url: str
    secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    cors_origins: list[str] = ["http://localhost:5173"]

    cookie_name: str = "hireflow_session"
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    upload_dir: str = "uploads"
    max_resume_bytes: int = Field(5_000_000, gt=0)

    ai_provider: Literal["none", "anthropic", "openai"] = "none"
    ai_api_key: str = ""
    ai_model: str = ""
    ai_base_url: str = ""
    ai_timeout_seconds: int = Field(30, gt=0, le=120)
    ai_max_output_tokens: int = Field(2000, gt=0, le=8000)

    match_weight_required: float = Field(0.45, ge=0)
    match_weight_preferred: float = Field(0.15, ge=0)
    match_weight_text: float = Field(0.20, ge=0)
    match_weight_experience: float = Field(0.20, ge=0)
    match_text_saturation: float = Field(0.40, gt=0, le=1)

    protected_account_emails: list[str] = []
    trusted_proxy_count: int = Field(0, ge=0, le=5)
    enable_docs: bool = True

    storage_backend: Literal["local", "s3"] = "local"
    s3_endpoint_url: str = ""
    s3_bucket: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_region: str = "auto"

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        """Hosts hand out postgres:// or postgresql:// URLs. SQLAlchemy needs the psycopg driver."""
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix) :]
        return v

    @model_validator(mode="after")
    def _check(self) -> "Settings":
        if self.storage_backend == "s3" and not all(
            [self.s3_endpoint_url, self.s3_bucket, self.s3_access_key_id, self.s3_secret_access_key]
        ):
            raise ValueError("STORAGE_BACKEND=s3 needs S3_ENDPOINT_URL, S3_BUCKET and both S3 keys")
        if self.environment not in {"development", "test"} and len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters outside development/test")
        total = (
            self.match_weight_required
            + self.match_weight_preferred
            + self.match_weight_text
            + self.match_weight_experience
        )
        if total <= 0:
            raise ValueError("At least one MATCH_WEIGHT_* must be greater than zero")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
