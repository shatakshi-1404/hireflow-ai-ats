"""LLM provider interface. Routes and services never contain provider-specific code.
Errors never include response bodies, because those can echo resume content."""

import json
import logging
import re
from typing import Any, Protocol

import httpx

from app.core.config import get_settings

log = logging.getLogger(__name__)


class ProviderError(Exception):
    pass


class LLMProvider(Protocol):
    name: str
    model: str

    def complete(self, *, system: str, user: str, max_tokens: int) -> str: ...


def _post(url: str, headers: dict[str, str], payload: dict[str, Any], timeout: float) -> dict[str, Any]:
    try:
        response = httpx.post(url, headers=headers, json=payload, timeout=timeout)
    except httpx.TimeoutException as exc:
        raise ProviderError("timeout") from exc
    except httpx.HTTPError as exc:
        raise ProviderError("network error") from exc
    if response.status_code != 200:
        raise ProviderError(f"HTTP {response.status_code}")
    try:
        data = response.json()
    except ValueError as exc:
        raise ProviderError("invalid JSON envelope") from exc
    if not isinstance(data, dict):
        raise ProviderError("unexpected response")
    return data


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, api_key: str, model: str, timeout: float, base_url: str = "") -> None:
        self.api_key, self.model, self.timeout = api_key, model, timeout
        self.url = (base_url.rstrip("/") or "https://api.anthropic.com") + "/v1/messages"

    def complete(self, *, system: str, user: str, max_tokens: int) -> str:
        data = _post(
            self.url,
            {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            {
                "model": self.model,
                "max_tokens": max_tokens,
                "system": system,
                "messages": [{"role": "user", "content": user}],
            },
            self.timeout,
        )
        try:
            return "".join(
                b["text"] for b in data["content"] if isinstance(b, dict) and b.get("type") == "text"
            )
        except (KeyError, TypeError) as exc:
            raise ProviderError("unexpected response shape") from exc


class OpenAIProvider:
    name = "openai"

    def __init__(self, api_key: str, model: str, timeout: float, base_url: str = "") -> None:
        self.api_key, self.model, self.timeout = api_key, model, timeout
        self.url = (base_url.rstrip("/") or "https://api.openai.com/v1") + "/chat/completions"

    def complete(self, *, system: str, user: str, max_tokens: int) -> str:
        data = _post(
            self.url,
            {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            {
                "model": self.model,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
            self.timeout,
        )
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("unexpected response shape") from exc
        if not isinstance(content, str):
            raise ProviderError("unexpected response shape")
        return content


def get_provider() -> LLMProvider | None:
    """None means "use the deterministic fallback"."""
    s = get_settings()
    if s.ai_provider == "none":
        return None
    if not s.ai_api_key or not s.ai_model:
        log.warning("AI_PROVIDER=%s but AI_API_KEY or AI_MODEL is missing; using fallbacks", s.ai_provider)
        return None
    cls = AnthropicProvider if s.ai_provider == "anthropic" else OpenAIProvider
    return cls(s.ai_api_key, s.ai_model, float(s.ai_timeout_seconds), s.ai_base_url)


def provider_status() -> dict[str, Any]:
    provider = get_provider()
    if provider is None:
        return {"configured": False, "provider": "none", "model": None, "mode": "deterministic"}
    return {"configured": True, "provider": provider.name, "model": provider.model, "mode": "llm"}


_FENCE = re.compile(r"^```[a-zA-Z]*\s*|\s*```$")
_TAGS = re.compile(r"</?(resume|job|candidate)>", re.IGNORECASE)


def fence_safe(text: str, limit: int) -> str:
    """Trim untrusted text and remove tags that could close our delimiters early."""
    return _TAGS.sub("", text)[:limit]


def parse_json_object(raw: str) -> dict[str, Any]:
    text = _FENCE.sub("", raw.strip())
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in reply")
    obj = json.loads(text[start : end + 1])
    if not isinstance(obj, dict):
        raise ValueError("reply is not a JSON object")
    return obj
