"""Точка входа FastAPI: фабрика приложения create_app()."""

from fastapi import FastAPI

from app.api import admin, auth, candidates, health, public, vacancies
from app.config import get_settings
from app.security.errors import install_security_handlers


def create_app() -> FastAPI:
    """Создаёт приложение FastAPI.

    Фабрика используется тестами и скриптом экспорта OpenAPI
    (scripts/export_openapi.py). CORS намеренно не включается:
    single-origin архитектура, фронтенд и API обслуживаются одним origin.
    """
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Backend API системы учёта кандидатов «Очаково».",
    )
    install_security_handlers(app)
    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(admin.router)
    app.include_router(admin.options_router)
    app.include_router(public.router)
    app.include_router(candidates.router)
    app.include_router(vacancies.router)
    return app


app = create_app()
