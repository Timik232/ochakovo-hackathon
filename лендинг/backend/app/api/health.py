"""Health-эндпоинты: liveness без БД и readiness с проверкой БД и головы миграций."""

from pathlib import Path
from typing import Literal

from alembic.script import ScriptDirectory
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db import get_db
from app.security.errors import APIError

router = APIRouter(prefix="/api/health", tags=["health"])

_MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"

DEGRADED_MESSAGE = "Сервис временно недоступен"


class HealthLiveOut(BaseModel):
    """Liveness-ответ: процесс жив, БД не проверяется."""

    status: Literal["ok"] = "ok"


class HealthReadyOut(BaseModel):
    """Readiness-ответ: БД доступна и схема на ожидаемой голове миграций."""

    status: Literal["ok"] = "ok"
    database: Literal["up"] = "up"


def detect_schema_head(migrations_dir: Path = _MIGRATIONS_DIR) -> str:
    """Единственная голова миграций из каталога versions (без хардкода).

    Несколько голов — ошибка конфигурации: падаем громко на старте,
    а не выдаём ложную готовность.
    """
    heads = ScriptDirectory(str(migrations_dir)).get_heads()
    if len(heads) != 1:
        raise RuntimeError(f"migrations: expected exactly one head, got {sorted(heads)!r}")
    return heads[0]


# Кэш на уровне модуля: каталог миграций сканируется один раз при импорте (старте).
EXPECTED_SCHEMA_HEAD = detect_schema_head()


@router.get("/live", response_model=HealthLiveOut)
def live() -> HealthLiveOut:
    """Liveness: всегда 200, без обращения к БД."""
    return HealthLiveOut()


@router.get("/ready", response_model=HealthReadyOut)
def ready(db: Session = Depends(get_db)) -> HealthReadyOut:
    """Readiness: БД доступна И alembic_version равна ожидаемой голове.

    Ошибки — санитизированные 503-конверты (DB_UNAVAILABLE / SCHEMA_MISMATCH)
    с request_id, без деталей SQL; процесс не падает.
    """
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise APIError(503, "DB_UNAVAILABLE", DEGRADED_MESSAGE) from exc
    try:
        current = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
    except SQLAlchemyError as exc:
        # SELECT 1 прошёл — БД отвечает, но таблицы alembic_version нет: схема не та.
        raise APIError(503, "SCHEMA_MISMATCH", DEGRADED_MESSAGE) from exc
    if current != EXPECTED_SCHEMA_HEAD:
        raise APIError(503, "SCHEMA_MISMATCH", DEGRADED_MESSAGE)
    return HealthReadyOut()
