# ruff: noqa: F811
import uuid
from datetime import timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    Candidate,
    CandidateComment,
    Employee,
    PrivacyConfig,
    Vacancy,
)
from tests.t2_support import policy, t2_db, t2_engine  # noqa: F401
from tests.test_auth import account, client, login  # noqa: F401


@pytest.fixture
def intake(client: TestClient, t2_db: Session):
    policy(t2_db)
    vacancy = Vacancy(
        slug=str(uuid.uuid4()),
        title="Лаборант",
        dept="Цех",
        pay="",
        schedule="",
        icon="lab",
        sort=1,
    )
    t2_db.add(vacancy)
    t2_db.commit()
    from app.config import get_settings

    with patch.object(get_settings(), "submission_hmac_secret", "s" * 32):
        yield {
            "last_name": " Семёнов ",
            "first_name": "Тест",
            "phone": "8 (495) 123-45-67",
            "age": 18,
            "who": "student",
            "vacancy_id": str(vacancy.id),
            "consent": True,
            "privacy_revision": 1,
        }


def submit(client, body, key=None):
    return client.post(
        "/api/v1/public/applications",
        json=body,
        headers={"Idempotency-Key": key or str(uuid.uuid4())},
    )


def staff(client, db, role="staff"):
    account(db, role=role)
    assert login(client).status_code == 200
    client.headers["X-CSRF-Token"] = client.get("/api/v1/auth/me").json()["csrf_token"]


def manual(body):
    return {
        k: v
        for k, v in {**body, "source": "phone", "processing_basis": "candidate_consent"}.items()
        if k not in ("consent", "privacy_revision")
    }


def test_public_happy_replay_and_privacy(client, t2_db, intake):
    assert set(client.get("/api/v1/public/privacy").json()) == {
        "notice",
        "consent",
        "revision",
        "collection_enabled",
    }
    assert len(client.get("/api/v1/public/vacancies").json()) >= 1
    key = str(uuid.uuid4())
    first = submit(client, intake, key)
    assert first.status_code == 201 and first.json() == {"message": "Анкета принята"}
    row = t2_db.scalar(select(Candidate))
    assert row.status == "application" and row.source == "public_form"
    assert row.phone == "+74951234567" and row.created_by is None and row.privacy_revision == 1
    assert row.retention_due_at - row.consent_at == timedelta(days=30)
    config = t2_db.get(PrivacyConfig, 1)
    config.collection_enabled = False
    config.revision = 2
    t2_db.commit()
    assert submit(client, intake, key).json() == first.json()
    assert submit(client, {**intake, "age": 19}, key).status_code == 409
    assert submit(client, intake).status_code == 503
    assert t2_db.scalar(select(func.count()).select_from(Candidate)) == 1


@pytest.mark.parametrize(
    "field,value",
    [
        ("age", 17),
        ("age", 81),
        ("age", 17.5),
        ("age", True),
        ("who", "invalid"),
        ("phone", "123"),
        ("consent", False),
        ("vacancy_id", str(uuid.uuid4())),
        ("email", "bad"),
        ("resume_url", "javascript:alert(1)"),
        ("telegram", "@bad name"),
        ("created_at", "2026-01-01"),
        ("status", "hired"),
        ("source", "phone"),
        ("event", "x" * 101),
        ("last_name", " "),
        ("grad_year", 2101),
        ("start_date", "2000-01-01"),
    ],
)
def test_public_validation(client, intake, field, value):
    assert submit(client, {**intake, field: value}).status_code == 422


def test_public_gates_honeypot_and_revision(client, t2_db, intake):
    assert submit(client, {**intake, "website": "spam"}).status_code == 201
    assert t2_db.scalar(select(func.count()).select_from(Candidate)) == 0
    assert (
        submit(client, {**intake, "privacy_revision": 2}).json()["code"]
        == "PRIVACY_REVISION_CHANGED"
    )
    row = t2_db.get(Vacancy, uuid.UUID(intake["vacancy_id"]))
    row.is_active = False
    t2_db.commit()
    assert submit(client, intake).status_code == 422
    assert all(
        v["id"] != intake["vacancy_id"] for v in client.get("/api/v1/public/vacancies").json()
    )


def test_staff_crud_duplicates_comments_and_delete(client, t2_db, intake):
    staff(client, t2_db, "admin")
    response = client.post(
        "/api/v1/candidates", json={**manual(intake), "age": 15, "telegram": "@@TeST"}
    )
    assert response.status_code == 201, response.text
    row = response.json()
    assert row["status"] == "new" and row["telegram"] == "@test"
    assert row["duplicate_contact_count"] == 0
    second = client.post("/api/v1/candidates", json=manual(intake)).json()
    assert second["duplicate_contact_count"] == 1
    path = "/api/v1/candidates/" + row["id"]
    assert client.get(path).json()["duplicate_contact_count"] == 1
    edited = client.patch(path, json={"version": 1, "status": "hired", "city": "Москва"})
    assert edited.status_code == 200, edited.text
    assert edited.json()["version"] == 2 and edited.json()["created_at"] == row["created_at"]
    assert client.patch(path, json={"version": 1, "status": "new"}).status_code == 409
    assert client.post(path + "/comments", json={"body": "  Заметка  "}).status_code == 201
    comments = client.get(path + "/comments").json()
    assert comments["items"][0]["body"] == "Заметка"
    assert client.post(path + "/comments", json={"body": " "}).status_code == 422
    for header, status in [(None, 422), ("2", 422), ('"bad"', 422), ('"1"', 409)]:
        assert (
            client.delete(path, headers={"If-Match": header} if header else {}).status_code
            == status
        )
    assert client.delete(path, headers={"If-Match": '"2"'}).status_code == 204
    assert client.get(path).status_code == 404
    assert t2_db.scalar(select(func.count()).select_from(CandidateComment)) == 0
    assert (
        t2_db.scalar(
            select(func.count())
            .select_from(AuditEvent)
            .where(AuditEvent.entity_id == uuid.UUID(row["id"]), AuditEvent.action == "delete")
        )
        == 1
    )


@pytest.mark.parametrize(
    "field",
    ["created_at", "source", "created_by", "consent_at", "privacy_revision", "retention_due_at"],
)
def test_immutable_patch(client, t2_db, intake, field):
    staff(client, t2_db)
    row = client.post("/api/v1/candidates", json=manual(intake)).json()
    assert (
        client.patch(
            "/api/v1/candidates/" + row["id"], json={"version": 1, field: None}
        ).status_code
        == 422
    )


@pytest.mark.parametrize("role", ["public", "pending", "staff", "admin"])
def test_role_matrix(client, t2_db, intake, role):
    assert submit(client, intake).status_code == 201
    identifier = str(t2_db.scalar(select(Candidate.id)))
    if role in ("staff", "admin"):
        staff(client, t2_db, role)
    elif role == "pending":
        staff(client, t2_db)
        actor = t2_db.scalar(select(Employee))
        actor.state = "pending"
        t2_db.commit()
    allowed = role in ("staff", "admin")
    for path in [
        "/candidates",
        "/candidates/" + identifier,
        "/candidates/" + identifier + "/comments",
        "/candidates/export.csv",
        "/vacancies",
    ]:
        response = client.get("/api/v1" + path)
        assert response.status_code == (200 if allowed else 401), response.text
    for path, body, expected in [
        ("/candidates", manual(intake), 201),
        ("/candidates/bulk", {"ids": [identifier], "action": "archive"}, 200),
        ("/candidates/" + identifier + "/comments", {"body": "Тест"}, 201),
        ("/vacancies", {"slug": str(uuid.uuid4()), "title": "Тестовая"}, 201),
    ]:
        result = client.post("/api/v1" + path, json=body)
        assert result.status_code == (expected if allowed else 401), result.text
    for path, body in [
        ("/candidates/" + identifier, {"version": 2, "status": "hired"}),
        ("/vacancies/" + intake["vacancy_id"], {"is_active": False}),
    ]:
        result = client.patch("/api/v1" + path, json=body)
        assert result.status_code == (200 if allowed else 401), result.text
    assert client.delete(
        "/api/v1/candidates/" + identifier, headers={"If-Match": '"3"'}
    ).status_code == (204 if role == "admin" else 403 if role == "staff" else 401)
