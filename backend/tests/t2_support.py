"""T2 fixtures: migrations only, never create_all and never an implicit real DB."""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.models import Candidate, Employee, PrivacyConfig
from app.services.lifecycle import activate_privacy


def migration_config() -> Config:
    return Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))


@pytest.fixture
def t2_engine() -> Iterator[Engine]:
    url = os.environ["DATABASE_URL"]
    # The operator must explicitly designate a disposable database before destructive fixtures.
    if os.environ.get("T2_DISPOSABLE_DB") != "yes":
        pytest.skip("Set T2_DISPOSABLE_DB=yes only for disposable PostgreSQL")
    command.upgrade(migration_config(), "head")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(
            text("TRUNCATE candidates, employees, sessions, audit_events, privacy_config CASCADE")
        )
        connection.execute(text("INSERT INTO privacy_config (id) VALUES (1)"))
    yield engine
    engine.dispose()


@pytest.fixture
def t2_db(t2_engine: Engine) -> Iterator[Session]:
    with Session(t2_engine) as db:
        yield db
        db.rollback()


def policy(db: Session, days: int = 30) -> PrivacyConfig:
    return activate_privacy(
        db,
        operator_identity="Synthetic test operator",
        notice="Synthetic test notice",
        consent="Synthetic consent",
        revision=1,
        retention_days=days,
        authorized=True,
        origin="https://example.test",
    )


def employee(db: Session, email: str = "operator@example.test", role: str = "admin") -> Employee:
    result = Employee(
        email=email,
        first_name="Тест",
        last_name="Оператор",
        position="Тест",
        password_hash="unusable-test-fixture",
        role=role,
        state="active",
    )
    db.add(result)
    db.flush()
    return result


def candidate(db: Session, creator: Employee | None = None) -> Candidate:
    result = Candidate(
        first_name="Тест",
        last_name="Семёнов",
        phone="+79990000001",
        city="Тестовый город",
        position="Тестовый инженер",
        source="phone" if creator else "public_form",
        created_by=creator.id if creator else None,
        processing_basis="candidate_consent",
    )
    db.add(result)
    db.flush()
    db.refresh(result)
    return result
