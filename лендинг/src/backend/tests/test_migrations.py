"""Real PostgreSQL constraints, migration reversibility, provenance and query plans."""

import uuid
from datetime import UTC, datetime

import pytest
from alembic import command
from alembic.script import ScriptDirectory
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel, ConfigDict
from sqlalchemy import DateTime, inspect, select, text, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    SEARCH_EXPRESSION,
    AuditEvent,
    Candidate,
    CandidateComment,
    Employee,
    PublicSubmission,
)
from tests.t2_support import candidate, employee, migration_config, policy
from tests.t2_support import t2_db as t2_db
from tests.t2_support import t2_engine as t2_engine


def test_migration_cycle(t2_engine: Engine) -> None:
    config = migration_config()
    assert len(ScriptDirectory.from_config(config).get_heads()) == 1
    command.downgrade(config, "base")
    assert inspect(t2_engine).get_table_names() == ["alembic_version"]
    command.upgrade(config, "head")
    names = set(inspect(t2_engine).get_table_names())
    assert names == {
        "alembic_version",
        "employees",
        "sessions",
        "candidates",
        "candidate_comments",
        "public_submissions",
        "audit_events",
        "privacy_config",
        "vacancies",
    }
    columns = {c["name"]: c for c in inspect(t2_engine).get_columns("candidates")}
    assert columns["created_at"]["nullable"] is False
    assert isinstance(columns["created_at"]["type"], DateTime)
    assert columns["created_at"]["type"].timezone
    assert "now()" in (columns["created_at"]["default"] or "")
    print("PG17 migration cycle: upgrade head -> downgrade base -> upgrade head; single head")


@pytest.mark.parametrize(
    "values",
    [
        {"role": "superuser"},
        {"state": "unknown"},
        {"email": "Mixed@example.test"},
    ],
)
def test_employee_checks(t2_db: Session, values: dict[str, str]) -> None:
    fields = {
        "email": "test@example.test",
        "first_name": "A",
        "last_name": "B",
        "position": "Test",
        "password_hash": "not-a-real-password",
    }
    fields.update(values)
    with pytest.raises(IntegrityError):
        t2_db.add(Employee(**fields))
        t2_db.flush()


def test_employee_unique(t2_db: Session) -> None:
    employee(t2_db)
    with pytest.raises(IntegrityError):
        employee(t2_db)


@pytest.mark.parametrize(
    "column,value",
    [
        ("status", "fake"),
        ("source", "fake"),
        ("priority", "urgent"),
        ("expected_salary", -1),
        ("version", 0),
        ("responsible_id", uuid.uuid4()),
        ("phone", "123"),
        ("processing_basis", "none"),
    ],
)
def test_candidate_checks(t2_db: Session, column: str, value: object) -> None:
    policy(t2_db)
    record = candidate(t2_db)
    with pytest.raises(IntegrityError):
        t2_db.execute(update(Candidate).where(Candidate.id == record.id).values({column: value}))


def test_submissions_unique_fk_and_cascade(t2_db: Session) -> None:
    policy(t2_db)
    record = candidate(t2_db)
    actor = employee(t2_db)
    submission = PublicSubmission(key_hash="a" * 64, payload_hmac="b" * 64, candidate_id=record.id)
    t2_db.add_all(
        [
            submission,
            CandidateComment(candidate_id=record.id, created_by=actor.id, body="Synthetic comment"),
        ]
    )
    t2_db.flush()
    with pytest.raises(IntegrityError), t2_db.begin_nested():
        t2_db.add(
            PublicSubmission(key_hash="a" * 64, payload_hmac="c" * 64, candidate_id=record.id)
        )
        t2_db.flush()
    with pytest.raises(IntegrityError), t2_db.begin_nested():
        t2_db.add(
            PublicSubmission(key_hash="d" * 64, payload_hmac="c" * 64, candidate_id=uuid.uuid4())
        )
        t2_db.flush()
    t2_db.delete(record)
    t2_db.flush()
    assert t2_db.scalar(select(PublicSubmission.id)) is None
    assert t2_db.scalar(select(CandidateComment.id)) is None


def test_created_at_server_default_and_immutable(t2_db: Session) -> None:
    policy(t2_db)
    actor = employee(t2_db)
    for creator in (None, actor):
        record = candidate(t2_db, creator)
        created = record.created_at
        assert created.tzinfo is not None
        assert record.status == ("application" if creator is None else "new")
        assert record.phone_digits == "79990000001"
        due = record.retention_due_at
        record.status = "review"
        record.city = "Другой тестовый город"
        t2_db.flush()
        t2_db.add(CandidateComment(candidate_id=record.id, created_by=actor.id, body="Synthetic"))
        t2_db.flush()
        t2_db.refresh(record)
        assert record.created_at == created
        assert record.retention_due_at == due
        assert (due - created).days == 30
        for field, value in (
            ("created_at", datetime(2000, 1, 1, tzinfo=UTC)),
            ("source", "other"),
            ("retention_due_at", datetime.now(UTC)),
        ):
            with pytest.raises(IntegrityError), t2_db.begin_nested():
                t2_db.execute(
                    update(Candidate).where(Candidate.id == record.id).values({field: value})
                )


def test_created_at_request_schema_contract_stub() -> None:
    """Explicit T5 handoff: schema policy proof on a TEST router, not production intake."""

    class Request(BaseModel):
        model_config = ConfigDict(extra="forbid")
        first_name: str

    app = FastAPI()

    @app.post("/contract-stub")
    def submit(body: Request) -> dict[str, str]:
        return {"first_name": body.first_name}

    with TestClient(app) as client:
        assert (
            client.post(
                "/contract-stub", json={"first_name": "Тест", "created_at": "2000-01-01"}
            ).status_code
            == 422
        )


def test_search_query_plans_10k(t2_db: Session) -> None:
    policy(t2_db)
    t2_db.execute(
        text("""
      INSERT INTO candidates(first_name,last_name,phone,position,city,source,processing_basis)
      SELECT 'Тест', CASE WHEN n=5555 THEN 'Семёнов-уникальный' ELSE 'Синтетический-'||n END,
        '+7999'||lpad(n::text,7,'0'), 'Тестовая должность', 'Тестовый город',
        'public_form', 'candidate_consent' FROM generate_series(1,10000) n
    """)
    )
    t2_db.execute(text("ANALYZE candidates"))
    # Flush the GIN pending list; keep the real planner enabled (no enable_seqscan hacks).
    t2_db.execute(text("SELECT gin_clean_pending_list('ix_candidates_search')"))
    t2_db.execute(text("SELECT gin_clean_pending_list('ix_candidates_phone_digits')"))
    for expression, query, index in (
        (SEARCH_EXPRESSION, "%семенов-уникальный%", "ix_candidates_search"),
        ("phone_digits", "%0005555%", "ix_candidates_phone_digits"),
    ):
        plan = "\n".join(
            t2_db.scalars(
                text(f"EXPLAIN SELECT id FROM candidates WHERE {expression} LIKE :q"), {"q": query}
            )
        )
        print(plan)
        assert index in plan
        assert (
            t2_db.scalar(
                text(f"SELECT count(*) FROM candidates WHERE {expression} LIKE :q"), {"q": query}
            )
            == 1
        )


def test_audit_rejects_content(t2_db: Session) -> None:
    with pytest.raises(IntegrityError):
        t2_db.add(
            AuditEvent(
                actor_id=uuid.uuid4(),
                entity_id=uuid.uuid4(),
                action="update",
                changed_fields=["Synthetic private candidate text"],
            )
        )
        t2_db.flush()
