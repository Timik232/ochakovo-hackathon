"""V4 schema, privacy-preserving contacts and synthetic seed on disposable PG17."""

import uuid
from datetime import UTC, datetime

import pytest
from alembic import command
from sqlalchemy import delete, inspect, select, text, update
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.cli import main
from app.config import get_settings
from app.models import AuditEvent, Candidate
from app.services import lifecycle
from tests.t2_support import candidate, employee, migration_config, policy
from tests.t2_support import t2_db as t2_db
from tests.t2_support import t2_engine as t2_engine

NEW_FIELDS = {
    "telegram", "age", "who", "edu_level", "school", "specialty", "grad_year", "vacancy_id",
    "employment", "shifts", "resume_url", "about", "event", "hot", "rating", "next_step",
    "archived_at",
}


def vacancy(db: Session, slug: str = "test") -> models.Vacancy:
    row = models.Vacancy(slug=slug, title="Тест", dept="Тест", pay="", schedule="", icon="can", sort=10)
    db.add(row)
    db.flush()
    return row


def test_v2_schema_and_roundtrip(t2_engine: Engine) -> None:
    config = migration_config()
    # v3 (a5f2e8d01c9b) made city/position optional; "-1" now stops at v4,
    # so target the baseline revision explicitly.
    command.downgrade(config, "85d0ea9c70bc")
    inspector = inspect(t2_engine)
    assert "vacancies" not in inspector.get_table_names()
    assert not NEW_FIELDS.intersection(c["name"] for c in inspector.get_columns("candidates"))
    status = next(c["sqltext"] for c in inspector.get_check_constraints("candidates") if c["name"] == "ck_candidates_status")
    assert "contacted" in status and "rejected" in status
    command.upgrade(config, "head")
    inspector = inspect(t2_engine)
    columns = {c["name"]: c for c in inspector.get_columns("candidates")}
    assert columns.keys() >= NEW_FIELDS
    assert columns["archived_at"]["type"].timezone
    assert not columns["hot"]["nullable"] and not columns["rating"]["nullable"]
    for field in NEW_FIELDS - {"hot", "rating"}:
        assert columns[field]["nullable"]
    indexes = {i["name"]: i for i in inspector.get_indexes("candidates")}
    assert indexes["ix_candidates_vacancy_id"]["column_names"] == ["vacancy_id"]
    assert "archived_at IS NULL" in str(indexes["ix_candidates_archived_at"]["dialect_options"])
    assert next(i for i in inspector.get_indexes("vacancies") if i["name"] == "ix_vacancies_is_active_sort")["column_names"] == ["is_active", "sort"]
    assert "telegram" not in models.SEARCH_EXPRESSION
    print("V2 roundtrip: head -> baseline -> head; columns, old status restoration, indexes PASS")


@pytest.mark.parametrize("field,value", [
    ("age", 13), ("age", 81), ("who", "invalid"), ("edu_level", "invalid"),
    ("grad_year", 1949), ("grad_year", 2101), ("employment", "invalid"),
    ("rating", -1), ("rating", 6), ("rating", None), ("hot", None),
    ("status", "contacted"), ("status", "rejected"), ("vacancy_id", uuid.uuid4()),
    *[(name, "x" * (length + 1)) for name, length in {
        "telegram": 64, "school": 200, "specialty": 200, "shifts": 200,
        "resume_url": 500, "about": 2000, "event": 100, "next_step": 500,
    }.items()],
])
def test_new_candidate_constraints(t2_db: Session, field: str, value: object) -> None:
    policy(t2_db)
    row = candidate(t2_db)
    with pytest.raises(DBAPIError), t2_db.begin_nested():
        t2_db.execute(update(Candidate).where(Candidate.id == row.id).values({field: value}))


@pytest.mark.parametrize("field,length", [("slug", 40), ("title", 150), ("dept", 150), ("pay", 100), ("schedule", 200), ("icon", 40)])
def test_vacancy_lengths(t2_db: Session, field: str, length: int) -> None:
    row = vacancy(t2_db)
    with pytest.raises(DBAPIError), t2_db.begin_nested():
        t2_db.execute(update(models.Vacancy).where(models.Vacancy.id == row.id).values({field: "x" * (length + 1)}))


def test_vacancy_unique_restrict_and_editability(t2_db: Session) -> None:
    policy(t2_db)
    first, second = vacancy(t2_db), vacancy(t2_db, "second")
    assert first.is_active and first.created_at.tzinfo and first.updated_at.tzinfo
    with pytest.raises(IntegrityError), t2_db.begin_nested():
        vacancy(t2_db)
    row = candidate(t2_db)
    assert row.hot is False and row.rating == 0
    created, due = row.created_at, row.retention_due_at
    row.vacancy_id = first.id
    t2_db.flush()
    with pytest.raises(IntegrityError), t2_db.begin_nested():
        t2_db.execute(delete(models.Vacancy).where(models.Vacancy.id == first.id))
    row.vacancy_id = second.id
    row.hot, row.rating, row.next_step = True, 5, "Тестовый звонок"
    row.archived_at = datetime.now(UTC)
    row.age, row.grad_year, row.who, row.edu_level, row.employment = 14, 1950, "school", "school", "practice"
    t2_db.flush()
    row.age, row.grad_year, row.status, row.archived_at = 80, 2100, "review", None
    t2_db.flush()
    row.status = "reject"
    t2_db.flush()
    t2_db.refresh(row)
    assert row.created_at == created and row.retention_due_at == due and row.vacancy_id == second.id
    actor = employee(t2_db)
    with pytest.raises(IntegrityError), t2_db.begin_nested():
        t2_db.execute(update(Candidate).where(Candidate.id == row.id).values(created_by=actor.id))


def test_telegram_storage_and_duplicate_contacts(t2_db: Session) -> None:
    policy(t2_db)
    first, second, third = candidate(t2_db), candidate(t2_db), candidate(t2_db)
    first.telegram = " @@Synthetic_User "
    second.phone, second.telegram = "+79990000002", "@SYNTHETIC_USER"
    third.phone, third.telegram = "+79990000003", "@unrelated"
    t2_db.flush()
    assert first.telegram == "@synthetic_user"
    assert lifecycle.duplicate_contact_count(t2_db, phone="+7 (999) 000-00-01", telegram="@@SYNTHETIC_USER", exclude_id=first.id) == 1
    assert lifecycle.duplicate_contact_count(t2_db, phone=first.phone, telegram=first.telegram) == 2
    assert lifecycle.duplicate_contact_count(t2_db, phone=None, telegram=" @Synthetic_User ") == 2
    assert lifecycle.duplicate_contact_count(t2_db, phone=None, telegram="@@") == 0
    t2_db.execute(text("UPDATE candidates SET telegram = ' @@RAW_SQL ' WHERE id = :id"), {"id": third.id})
    t2_db.refresh(third)
    assert third.telegram == "@raw_sql"
    assert lifecycle.duplicate_contact_count(t2_db, phone=third.phone, exclude_id=first.id) == 1


def test_new_audit_fields_names_only(t2_db: Session) -> None:
    assert set(models.AUDIT_FIELDS) >= NEW_FIELDS
    lifecycle.audit(t2_db, "update", uuid.uuid4(), sorted(NEW_FIELDS))
    t2_db.flush()
    assert t2_db.scalar(select(AuditEvent.changed_fields)) == sorted(NEW_FIELDS)
    with pytest.raises(IntegrityError), t2_db.begin_nested():
        lifecycle.audit(t2_db, "update", uuid.uuid4(), ["@synthetic_private_contact"])
        t2_db.flush()


def test_seed_v4_vacancies_and_enriched_candidates(t2_engine: Engine, monkeypatch: pytest.MonkeyPatch) -> None:
    with Session(t2_engine) as db:
        policy(db)
        db.execute(delete(models.Vacancy))
        db.commit()
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    try:
        assert main(["seed-demo"]) == 0
        with Session(t2_engine) as db:
            vacancies = list(db.scalars(select(models.Vacancy).order_by(models.Vacancy.sort)))
            assert [v.slug for v in vacancies] == ["lab", "rozliv", "tech", "sklad", "kladov", "mash", "technolog", "free", "open"]
            assert vacancies[0].title == "Лаборант / химик-лаборант"
            assert vacancies[6].dept == "Отдел новых вкусов"
            rows = list(db.scalars(select(Candidate)))
            assert len(rows) == 45 and all(c.vacancy_id and c.telegram and c.who for c in rows)
            minors = [c for c in rows if c.age < 18]
            assert len(minors) == 2
            assert all(c.created_by and c.source != "public_form" and c.employment == "practice" for c in minors)
            assert len({c.edu_level for c in rows}) >= 3
            assert len({c.employment for c in rows}) == 4
            assert len({c.vacancy_id for c in rows}) == 9
            assert any(c.hot and c.rating and c.next_step for c in rows)
            assert sum(c.archived_at is not None for c in rows) == 2
        assert main(["seed-demo", "--count", "1"]) == 0
        with Session(t2_engine) as db:
            assert len(list(db.scalars(select(models.Vacancy)))) == 9
    finally:
        get_settings.cache_clear()
