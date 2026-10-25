# ruff: noqa: F811
import csv
import io
import uuid
from unittest.mock import patch

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.models import AuditEvent, Vacancy
from tests.t2_support import t2_db, t2_engine  # noqa: F401
from tests.test_auth import client  # noqa: F401
from tests.test_candidates import intake, manual, staff  # noqa: F401


def create(client, intake, **extra):
    response = client.post("/api/v1/candidates", json={**manual(intake), **extra})
    assert response.status_code == 201, response.text
    return response.json()


def test_bulk_and_export(client, t2_db, intake):
    staff(client, t2_db)
    a = create(client, intake, about='Текст;"кавычки"\r\nновая строка', next_step="=1+1")
    b = create(client, intake, telegram="@other")
    ids = [a["id"], b["id"]]
    path = "/api/v1/candidates/bulk"
    assert client.post(path, json={"ids": ids, "action": "archive"}).json() == {"updated": 2}
    assert client.get("/api/v1/candidates").json()["total"] == 0
    archived = client.get("/api/v1/candidates", params={"archived": "1"}).json()["items"]
    assert all(row["status"] == "new" and row["version"] == 2 for row in archived)
    assert (
        client.post(path, json={"ids": ids, "action": "stage", "stage": "hired"}).status_code == 200
    )
    assert client.get("/api/v1/candidates/" + ids[0]).json()["archived_at"] is not None
    export = client.get("/api/v1/candidates/export.csv", params={"archived": "1"})
    assert export.content.startswith(b"\xef\xbb\xbf")
    assert "attachment" in export.headers["content-disposition"]
    rows = list(
        csv.reader(io.StringIO(export.text.removeprefix("\ufeff"), newline=""), delimiter=";")
    )
    assert rows[0] == [
        "ID",
        "Дата",
        "ФИО",
        "Телефон",
        "Telegram",
        "Email",
        "Возраст",
        "Кто",
        "Образование",
        "Вакансия",
        "Формат",
        "Готов начать",
        "Смена",
        "Резюме",
        "Опыт",
        "О себе",
        "Источник",
        "Кто заполнил",
        "Мероприятие",
        "Этап",
        "Оценка",
        "Горячий",
        "Следующий шаг",
    ]
    assert len(rows) == 3 and all(len(row) == 23 for row in rows)
    found = next(row for row in rows[1:] if row[0] == a["id"])
    assert found[15] == 'Текст;"кавычки"\r\nновая строка'
    assert found[-1] == "'=1+1" and found[9] == "Лаборант"
    searched = client.get("/api/v1/candidates/export.csv", params={"archived": "1", "q": "семен"})
    assert searched.status_code == 200
    assert len(list(csv.reader(io.StringIO(searched.text), delimiter=";"))) == 3
    assert "\r\n" in export.text and found[19] == "hired"
    assert (
        len(
            list(
                csv.reader(
                    io.StringIO(client.get("/api/v1/candidates/export.csv").text), delimiter=";"
                )
            )
        )
        == 1
    )
    assert client.post(path, json={"ids": ids, "action": "restore"}).status_code == 200
    assert client.get("/api/v1/candidates").json()["total"] == 2
    assert client.get("/api/v1/candidates/" + ids[0]).json()["version"] == 4
    filtered = client.get("/api/v1/candidates/export.csv", params={"q": "absent"})
    assert len(list(csv.reader(io.StringIO(filtered.text), delimiter=";"))) == 1


@pytest.mark.parametrize(
    "body",
    [
        {"ids": [], "action": "archive"},
        {"ids": [str(uuid.uuid4())] * 201, "action": "archive"},
        {"ids": [str(uuid.uuid4())], "action": "delete"},
        {"ids": [str(uuid.uuid4())], "action": "stage"},
        {"ids": [str(uuid.uuid4())], "action": "stage", "stage": "bad"},
        {"ids": [str(uuid.uuid4())], "action": "archive", "stage": "hired"},
    ],
)
def test_bulk_invalid(client, t2_db, intake, body):
    staff(client, t2_db)
    assert client.post("/api/v1/candidates/bulk", json=body).status_code == 422


def test_bulk_atomic_missing_and_fault(client, t2_db, intake):
    staff(client, t2_db)
    row = create(client, intake)
    body = {"ids": [row["id"], str(uuid.uuid4())], "action": "archive"}
    assert client.post("/api/v1/candidates/bulk", json=body).status_code == 404
    assert client.get("/api/v1/candidates/" + row["id"]).json()["version"] == 1
    assert client.post(
        "/api/v1/candidates/bulk", json={"ids": [row["id"], row["id"]], "action": "archive"}
    ).json() == {"updated": 1}


def test_vacancy_crud_restrict_and_audit(client, t2_db, intake):
    staff(client, t2_db)
    body = {"slug": str(uuid.uuid4()), "title": "Тестовая вакансия", "sort": -1}
    created = client.post("/api/v1/vacancies", json=body)
    assert created.status_code == 201
    row = created.json()
    path = "/api/v1/vacancies/" + row["id"]
    assert client.post("/api/v1/vacancies", json=body).status_code == 409
    assert client.patch(path, json={"slug": "new"}).status_code == 422
    assert client.patch(path, json={"is_active": False, "title": "Другое"}).status_code == 200
    assert client.delete(path).status_code == 405
    assert any(v["id"] == row["id"] for v in client.get("/api/v1/vacancies").json())
    assert all(v["id"] != row["id"] for v in client.get("/api/v1/public/vacancies").json())
    create(client, intake, vacancy_id=row["id"])
    with pytest.raises(IntegrityError):
        t2_db.delete(t2_db.get(Vacancy, uuid.UUID(row["id"])))
        t2_db.flush()
    t2_db.rollback()
    assert (
        t2_db.scalar(
            select(func.count())
            .select_from(AuditEvent)
            .where(AuditEvent.entity_id == uuid.UUID(row["id"]))
        )
        == 2
    )


def test_stream_uses_bounded_batches(client, t2_db, intake):
    staff(client, t2_db)
    create(client, intake)
    original = t2_db.execute
    options = []

    def execute(statement, *args, **kwargs):
        options.append(statement.get_execution_options())
        return original(statement, *args, **kwargs)

    with patch.object(t2_db, "execute", side_effect=execute):
        assert client.get("/api/v1/candidates/export.csv").status_code == 200
    assert any(option.get("yield_per") == 100 for option in options)
