"""Safe error envelopes. Never serialize exception details, inputs or request bodies."""

import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from starlette.exceptions import HTTPException


class APIError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def envelope(
    request: Request, status: int, code: str, message: str, fields: dict[str, str] | None = None
) -> JSONResponse:
    body: dict[str, object] = {
        "code": code,
        "message": message,
        "request_id": request.state.request_id,
    }
    if fields:
        body["field_errors"] = fields
    return JSONResponse(body, status_code=status)


def install_security_handlers(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        # Generate rather than trust attacker-provided identifiers (log injection).
        request.state.request_id = str(uuid.uuid4())
        try:
            response = await call_next(request)
        except Exception:
            # No exception logging: SQL/validation errors may embed PII or secrets.
            response = envelope(request, 500, "INTERNAL_ERROR", "Внутренняя ошибка сервера")
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.exception_handler(APIError)
    async def api_error(request: Request, exc: APIError) -> JSONResponse:
        return envelope(request, exc.status, exc.code, exc.message)

    @app.exception_handler(OperationalError)
    async def database_unavailable(request: Request, exc: OperationalError) -> JSONResponse:
        return envelope(request, 503, "SERVICE_UNAVAILABLE", "Сервис временно недоступен")

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # Only declared body field names: unknown keys and validator messages may contain PII.
        safe_fields = {
            "email",
            "first_name",
            "last_name",
            "position",
            "password",
            "current_password",
            "new_password",
            "phone",
            "age",
            "who",
            "vacancy_id",
            "consent",
            "privacy_revision",
            "telegram",
            "edu_level",
            "school",
            "specialty",
            "grad_year",
            "employment",
            "start_date",
            "shifts",
            "resume_url",
            "experience",
            "about",
            "event",
            "city",
            "middle_name",
            "processing_basis",
            "processing_basis_note",
            "version",
            "body",
            "rating",
            "hot",
            "next_step",
            "expected_salary",
            "responsible_id",
            "priority",
        }
        fields = {
            str(error["loc"][1]): "Проверьте значение поля"
            for error in exc.errors()
            if len(error["loc"]) == 2
            and error["loc"][0] == "body"
            and error["loc"][1] in safe_fields
        }
        for name, message in {
            "first_name": "Напиши имя",
            "last_name": "Напиши фамилию",
            "age": "На стажировку и работу берём с 18 лет",
        }.items():
            if name in fields:
                fields[name] = message
        return envelope(request, 422, "VALIDATION_ERROR", "Проверьте поля формы", fields)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        codes = {
            401: "UNAUTHENTICATED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
            429: "RATE_LIMITED",
            503: "SERVICE_UNAVAILABLE",
        }
        message = (
            "Слишком много запросов. Попробуйте позже"
            if exc.status_code == 429
            else "Запрос отклонён"
        )
        response = envelope(
            request, exc.status_code, codes.get(exc.status_code, "HTTP_ERROR"), message
        )
        if exc.headers and "Retry-After" in exc.headers:
            response.headers["Retry-After"] = exc.headers["Retry-After"]
        return response
