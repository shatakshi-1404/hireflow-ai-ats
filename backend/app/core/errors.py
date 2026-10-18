from typing import TypeVar

T = TypeVar("T")


class AppError(Exception):
    status_code = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class AuthError(AppError):
    status_code = 401


class ForbiddenError(AppError):
    status_code = 403


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409


class UnprocessableError(AppError):
    status_code = 422


def require(obj: T | None, what: str) -> T:
    """Return obj or raise 404. Used after workspace-scoped lookups."""
    if obj is None:
        raise NotFoundError(f"{what} not found")
    return obj


class PayloadTooLargeError(AppError):
    status_code = 413


class ServiceUnavailableError(AppError):
    status_code = 503
