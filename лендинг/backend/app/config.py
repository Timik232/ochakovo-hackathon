"""Настройки приложения: все значения берутся из переменных окружения."""

from functools import lru_cache
from typing import Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Основные настройки сервиса. Значения по умолчанию пригодны для локальной разработки."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "Очаково — Кадровый журнал"
    app_env: str = "development"  # development | test | demo | production
    database_url: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/postgres"
    log_level: str = "INFO"
    app_origin: str = "http://localhost:5173"
    development_origin: str | None = None
    cookie_secure: bool = True
    # Stable server-side secret, >=32 bytes; fail closed if intake is not configured.
    submission_hmac_secret: str | None = None

    @model_validator(mode="after")
    def force_secure_cookie(self) -> Self:
        if self.app_env not in {"test", "development"}:
            self.cookie_secure = True
        return self


@lru_cache
def get_settings() -> Settings:
    """Кэшированный доступ к настройкам (один экземпляр на процесс)."""
    return Settings()
