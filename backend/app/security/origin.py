from fastapi import Request

from app.config import get_settings
from app.security.errors import APIError


def require_origin(request: Request) -> None:
    settings = get_settings()
    allowed = {settings.app_origin}
    if settings.app_env == "development" and settings.development_origin:
        allowed.add(settings.development_origin)
    origins = request.headers.getlist("origin")
    if len(origins) != 1 or origins[0] not in allowed:
        raise APIError(403, "ORIGIN_FORBIDDEN", "Источник запроса не разрешён")


def require_json_origin(request: Request) -> None:
    require_origin(request)
    if (
        request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
        != "application/json"
    ):
        raise APIError(415, "JSON_REQUIRED", "Требуется application/json")
