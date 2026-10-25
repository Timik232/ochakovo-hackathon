"""V3 optional city/position: placeholder→NULL conversion and relaxed constraints."""

import pytest
from alembic import command
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.models import SEARCH_EXPRESSION, Candidate
from app.services.candidates import CandidateFilters, query_candidates, storage_values
from tests.t2_support import candidate, employee, migration_config, policy
from tests.t2_support import t2_db as t2_db
from tests.t2_support import t2_engine as t2_engine

V4 = "c42e8d781a6f"


def names_check(engine: Engine) -> str:
    return next(
        c["sqltext"]
        for c in inspect(engine).get_check_constraints("candidates")
        if c["name"] == "ck_candidates_names"
    )


def test_v3_schema_roundtrip(t2_engine: Engine) -> None:
    config = migration_config()
    command.downgrade(config, "-1")
    columns = {c["name"]: c for c in inspect(t2_engine).get_columns("candidates")}
    assert not columns["city"]["nullable"] and not columns["position"]["nullable"]
    assert "city" in names_check(t2_engine) and "position" in names_check(t2_engine)

    command.upgrade(config, "head")
    columns = {c["name"]: c for c in inspect(t2_engine).get_columns("candidates")}
    assert columns["city"]["nullable"] and columns["position"]["nullable"]
    relaxed = names_check(t2_engine)
    assert "city" not in relaxed and "position" not in relaxed
    assert "coalesce(position, '')" in SEARCH_EXPRESSION and "coalesce(city, '')" in SEARCH_EXPRESSION
    print("V3 roundtrip: nullable city/position, relaxed names CHECK, coalesce search PASS")


def test_v3_converts_placeholders_both_directions(t2_engine: Engine) -> None:
    config = migration_config()
    command.downgrade(config, V4)
    with Session(t2_engine) as db:
        policy(db)
        db.commit()
    with t2_engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO candidates(first_name,last_name,phone,city,position,"
                "source,processing_basis) "
                "VALUES ('Тест','Плейсхолдер','+79990000009','Не указан','Не указана',"
                "'public_form','candidate_consent')"
            )
        )
    command.upgrade(config, "head")
    with t2_engine.connect() as connection:
        assert connection.execute(
            text("SELECT city, position FROM candidates WHERE last_name = 'Плейсхолдер'")
        ).one() == (None, None)
    command.downgrade(config, V4)
    with t2_engine.connect() as connection:
        assert connection.execute(
            text("SELECT city, position FROM candidates WHERE last_name = 'Плейсхолдер'")
        ).one() == ("Не указан", "Не указана")
    command.upgrade(config, "head")


def test_v3_null_city_position_write_and_search(t2_db: Session) -> None:
    policy(t2_db)
    creator = employee(t2_db)
    row = candidate(t2_db, creator)
    row.city = None
    row.position = None
    t2_db.flush()
    t2_db.refresh(row)
    assert row.city is None and row.position is None

    found = t2_db.scalars(
        query_candidates(CandidateFilters(q="семёнов")).where(Candidate.id == row.id)
    ).all()
    assert [single.id for single in found] == [row.id]
    assert t2_db.scalars(
        query_candidates(CandidateFilters(city="Тестовый город"))
    ).all() == []


def test_storage_values_blank_optional_fields_become_none() -> None:
    assert storage_values({"city": "", "position": "", "start_date": None}) == {
        "city": None,
        "position": None,
        "available_from": None,
    }
    assert storage_values({"city": "Москва", "position": "Лаборант"}) == {
        "city": "Москва",
        "position": "Лаборант",
    }


@pytest.mark.parametrize("field", ["city", "position"])
def test_v3_blank_dto_normalizes_to_none(field: str) -> None:
    from app.schemas.candidates import CandidateCreate

    payload = {
        "first_name": "Тест",
        "last_name": "Семёнов",
        "phone": "+7 999 000-00-01",
        "source": "phone",
        "processing_basis": "candidate_consent",
        field: "   ",
    }
    assert getattr(CandidateCreate.model_validate(payload), field) is None
