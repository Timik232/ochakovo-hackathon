"""Тесты health-эндпоинтов: live без БД; ready — БД + голова миграций."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.script import ScriptDirectory
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.health import EXPECTED_SCHEMA_HEAD, detect_schema_head
from app.db import get_db
from app.main import create_app
from tests.t2_support import migration_config
from tests.t2_support import t2_engine as t2_engine


def override_db(app: FastAPI, engine: Engine) -> None:
    """Подменить зависимость get_db сессией на переданном engine."""
    factory = sessionmaker(bind=engine, class_=Session)

    def _db() -> Iterator[Session]:
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db


def test_live_ok() -> None:
    client = TestClient(create_app())
    response = client.get("/api/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_live_ignores_db_outage() -> None:
    app = create_app()
    dead_engine = create_engine(
        "postgresql+psycopg://postgres:test@127.0.0.1:1/postgres",
        connect_args={"connect_timeout": 1},
        pool_pre_ping=True,
    )
    override_db(app, dead_engine)
    client = TestClient(app)
    response = client.get("/api/health/live")
    assert response.status_code == 200
    dead_engine.dispose()


def test_expected_head_is_single_and_from_versions() -> None:
    config = migration_config()
    heads = ScriptDirectory.from_config(config).get_heads()
    assert heads[0] == EXPECTED_SCHEMA_HEAD
    assert len(heads) == 1


def test_detect_schema_head_ok(tmp_path: Path) -> None:
    versions = tmp_path / "versions"
    versions.mkdir()
    (versions / "aaa_base.py").write_text(
        'revision = "aaa"\ndown_revision = None\n', encoding="utf-8"
    )
    (versions / "bbb_child.py").write_text(
        'revision = "bbb"\ndown_revision = "aaa"\n', encoding="utf-8"
    )
    assert detect_schema_head(tmp_path) == "bbb"


@pytest.mark.parametrize(
    "files",
    [
        (
            'revision = "aaa"\ndown_revision = None\n',
            'revision = "bbb"\ndown_revision = None\n',
        ),  # две головы
        (
            'revision = "aaa"\ndown_revision = None\n',
            'revision = "bbb"\ndown_revision = "aaa"\n',
            'revision = "ccc"\ndown_revision = "aaa"\n',
        ),  # ветвление
    ],
)
def test_detect_schema_head_fails_loudly_on_multiple_heads(tmp_path: Path, files: tuple[str, ...]) -> None:
    versions = tmp_path / "versions"
    versions.mkdir()
    for index, content in enumerate(files):
        (versions / f"m{index}.py").write_text(content, encoding="utf-8")
    with pytest.raises(RuntimeError, match="one head"):
        detect_schema_head(tmp_path)


def test_detect_schema_head_fails_on_empty_dir(tmp_path: Path) -> None:
    (tmp_path / "versions").mkdir()
    with pytest.raises(RuntimeError, match="one head"):
        detect_schema_head(tmp_path)


def test_ready_ok_with_db(t2_engine: Engine) -> None:
    app = create_app()
    override_db(app, t2_engine)
    client = TestClient(app)
    response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "up"}


def test_ready_db_unavailable_envelope() -> None:
    app = create_app()
    dead_engine = create_engine(
        "postgresql+psycopg://postgres:test@127.0.0.1:1/postgres",
        connect_args={"connect_timeout": 1},
        pool_pre_ping=True,
    )
    override_db(app, dead_engine)
    client = TestClient(app)
    response = client.get("/api/health/ready")
    assert response.status_code == 503
    body = response.json()
    assert body["code"] == "DB_UNAVAILABLE"
    assert body["request_id"]
    assert "sqlalchemy" not in str(body).lower()
    assert response.headers["X-Request-ID"] == body["request_id"]
    dead_engine.dispose()


def test_ready_schema_mismatch_on_stale_version(t2_engine: Engine) -> None:
    config = migration_config()
    command.downgrade(config, "-1")
    try:
        app = create_app()
        override_db(app, t2_engine)
        client = TestClient(app)
        response = client.get("/api/health/ready")
        assert response.status_code == 503
        body = response.json()
        assert body["code"] == "SCHEMA_MISMATCH"
        assert body["request_id"]
        assert body["message"] == "Сервис временно недоступен"
    finally:
        command.upgrade(config, "head")


def test_ready_schema_mismatch_on_missing_version_table(t2_engine: Engine) -> None:
    config = migration_config()
    with t2_engine.begin() as connection:
        connection.execute(text("DROP TABLE alembic_version"))
    try:
        app = create_app()
        override_db(app, t2_engine)
        client = TestClient(app)
        response = client.get("/api/health/ready")
        assert response.status_code == 503
        assert response.json()["code"] == "SCHEMA_MISMATCH"
    finally:
        command.stamp(config, "head")
