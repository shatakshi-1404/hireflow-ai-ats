"""Small pure-ASGI middlewares: security headers, Origin check, early body-size limit."""

import json

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
UPLOAD_SUFFIXES = ("/ai/resume-analysis", "/candidates/import")

_STATIC_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


def _header(scope: Scope, name: bytes) -> str | None:
    for key, value in scope["headers"]:
        if key == name:
            return value.decode("latin-1")
    return None


async def _reject(send: Send, status: int, detail: str) -> None:
    body = json.dumps({"detail": detail}).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, hsts: bool = False) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        is_api = scope["path"].startswith("/api/")

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for key, value in _STATIC_HEADERS.items():
                    headers.setdefault(key, value)
                if is_api:
                    headers.setdefault("Cache-Control", "no-store")
                if self.hsts:
                    headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
            await send(message)

        await self.app(scope, receive, send_with_headers)


class OriginCheckMiddleware:
    """Reject cross-site browser writes. A request without an Origin header (non-browser client) passes."""

    def __init__(self, app: ASGIApp, allowed_origins: list[str]) -> None:
        self.app = app
        self.allowed = {o.rstrip("/").lower() for o in allowed_origins}

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["method"] in UNSAFE_METHODS:
            origin = _header(scope, b"origin")
            if origin is not None:
                normalized = origin.rstrip("/").lower()
                host = (_header(scope, b"host") or "").lower()
                same_host = bool(host) and normalized.partition("://")[2] == host
                if normalized not in self.allowed and not same_host:
                    await _reject(send, 403, "Cross-origin request blocked")
                    return
        await self.app(scope, receive, send)


class BodySizeLimitMiddleware:
    """Refuse oversized bodies up front using Content-Length. Chunked bodies are not covered."""

    def __init__(self, app: ASGIApp, default_limit: int, upload_limit: int) -> None:
        self.app = app
        self.default_limit = default_limit
        self.upload_limit = upload_limit

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["method"] in UNSAFE_METHODS:
            raw = _header(scope, b"content-length")
            if raw is not None and raw.isdigit():
                limit = self.upload_limit if scope["path"].endswith(UPLOAD_SUFFIXES) else self.default_limit
                if int(raw) > limit:
                    await _reject(send, 413, "Request body is too large")
                    return
        await self.app(scope, receive, send)
