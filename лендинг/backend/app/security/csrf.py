import hmac

from fastapi import Request

from app.models import Session as LoginSession
from app.security.errors import APIError
from app.security.origin import require_origin


def require_csrf(request: Request, session: LoginSession) -> None:
    require_origin(request)
    tokens = request.headers.getlist("x-csrf-token")
    if len(tokens) != 1 or not hmac.compare_digest(tokens[0].encode(), session.csrf_token.encode()):
        raise APIError(403, "CSRF_INVALID", "Не удалось проверить защиту запроса")
