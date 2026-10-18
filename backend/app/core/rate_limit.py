from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings


def client_key(request: Request) -> str:
    """Rate-limit key. With N trusted proxies, the Nth entry from the right of X-Forwarded-For is the
    client address as seen by the outermost trusted proxy. Entries further left are client-supplied
    and can be forged, so they are never used."""
    n = get_settings().trusted_proxy_count
    if n > 0:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            hops = [h.strip() for h in forwarded.split(",") if h.strip()]
            if len(hops) >= n:
                return hops[-n]
    return get_remote_address(request)


limiter = Limiter(key_func=client_key, enabled=get_settings().environment != "test")
