"""Минимальная проверка roundtrip к тестовой PostgreSQL (make test-up)."""

from sqlalchemy import text

from app.db import SessionLocal


def test_db_roundtrip() -> None:
    with SessionLocal() as session:
        value = session.execute(text("SELECT 1 + 1")).scalar_one()
    assert value == 2


def test_db_is_postgres_17() -> None:
    with SessionLocal() as session:
        version = session.execute(text("SHOW server_version")).scalar_one()
    assert version is not None
    assert version.startswith("17")
