from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.middleware import (
    BodySizeLimitMiddleware,
    OriginCheckMiddleware,
    SecurityHeadersMiddleware,
)
from app.core.rate_limit import limiter

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if settings.enable_docs else None,
    openapi_url="/openapi.json" if settings.enable_docs else None,
    redoc_url=None,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


# The last middleware added is the outermost, so security headers also cover the early rejections.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(OriginCheckMiddleware, allowed_origins=settings.cors_origins)
app.add_middleware(
    BodySizeLimitMiddleware,
    default_limit=1_000_000,
    upload_limit=settings.max_resume_bytes + 100_000,
)
app.add_middleware(SecurityHeadersMiddleware, hsts=settings.cookie_secure)

app.include_router(api_router)
