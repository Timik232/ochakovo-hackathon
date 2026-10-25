# ruff: noqa: F811
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError

from app.api import candidates
from app.config import get_settings
from app.models import AuditEvent, Candidate, PrivacyConfig, PublicSubmission
from tests.t2_support import t2_db, t2_engine  # noqa: F401
from tests.test_auth import client  # noqa: F401
from tests.test_candidates import intake, manual, staff, submit  # noqa: F401


@pytest.mark.parametrize("header", [None, "bad", str(uuid.uuid1())])
def test_idempotency_header(client, intake, header):
    assert (
        client.post(
            "/api/v1/public/applications",
            json=intake,
            headers={"Idempotency-Key": header} if header else {},
        ).status_code
        == 422
    )


def test_expired_reservation_and_missing_secret(client, t2_db, intake):
    with patch.object(get_settings(), "submission_hmac_secret", None):
        assert submit(client, intake).status_code == 503
    key = str(uuid.uuid4())
    assert submit(client, intake, key).status_code == 201
    reservation = t2_db.scalar(select(PublicSubmission))
    reservation.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    t2_db.commit()
    assert submit(client, intake, key).status_code == 201
    assert t2_db.scalar(select(func.count()).select_from(Candidate)) == 2
    assert t2_db.scalar(select(func.count()).select_from(PublicSubmission)) == 1


@pytest.mark.parametrize(
    "extra",
    [
        {"source": "public_form"},
        {"processing_basis": None},
        {"processing_basis": "other_documented_basis"},
        {"age": 13},
        {"age": 81},
        {"vacancy_id": str(uuid.uuid4())},
        {"responsible_id": str(uuid.uuid4())},
        {"created_at": "2026-01-01"},
        {"retention_due_at": "2027-01-01"},
        {"interview_at": "2026-12-01T12:00:00"},
        {"rating": 6},
        {"expected_salary": -1},
        {"expected_salary": "10000000.01"},
        {"start_date": "2000-01-01"},
    ],
)
def test_staff_validation(client, t2_db, intake, extra):
    staff(client, t2_db)
    assert client.post("/api/v1/candidates", json={**manual(intake), **extra}).status_code == 422


def test_full_fields_patch_audit_and_stopped_intake(client, t2_db, intake):
    staff(client, t2_db)
    response = client.post(
        "/api/v1/candidates",
        json={
            **manual(intake),
            "processing_basis": "other_documented_basis",
            "processing_basis_note": "Test documented",
            "middle_name": "Тестович",
            "start_date": (datetime.now(UTC) + timedelta(days=1)).date().isoformat(),
            "email": "TEST@example.test",
            "age": 16,
            "who": "school",
            "edu_level": "college",
            "school": "Тестовое училище",
            "specialty": "Технолог",
            "grad_year": 2028,
            "employment": "practice",
            "shifts": "День",
            "resume_url": "https://example.test/cv",
            "experience": "Нет",
            "about": "Тест",
            "event": "Тестовый фестиваль",
            "department": "Цех",
            "priority": "high",
            "expected_salary": "100.50",
            "next_contact_at": "2026-12-01T12:00:00+03:00",
            "interview_at": "2026-12-02T12:00:00+03:00",
            "rating": 3,
            "hot": True,
            "next_step": "Позвонить",
            "telegram": "@@TeSt",
        },
    )
    assert response.status_code == 201, response.text
    before = response.json()
    creation = t2_db.scalar(
        select(AuditEvent).where(
            AuditEvent.entity_id == uuid.UUID(before["id"]), AuditEvent.action == "create"
        )
    )
    assert "available_from" in creation.changed_fields
    assert "start_date" not in creation.changed_fields
    config = t2_db.get(PrivacyConfig, 1)
    config.collection_enabled = False
    t2_db.commit()
    assert client.post("/api/v1/candidates", json=manual(intake)).status_code == 503
    path = "/api/v1/candidates/" + before["id"]
    edited = client.patch(
        path, json={"version": 1, "about": "Новый текст", "start_date": "2000-01-01", "rating": 5}
    )
    assert edited.status_code == 200, edited.text
    after = edited.json()
    assert after["email"] == "test@example.test" and after["telegram"] == "@test"
    assert after["start_date"] == "2000-01-01" and after["rating"] == 5
    for field in (
        "created_at",
        "created_by",
        "source",
        "consent_at",
        "privacy_revision",
        "retention_due_at",
    ):
        assert before[field] == after[field]
    assert after["updated_by"] == before["created_by"] and after["version"] == 2
    assert client.post(path + "/comments", json={"body": "Тест"}).status_code == 201
    events = list(
        t2_db.scalars(
            select(AuditEvent).where(
                AuditEvent.entity_id == uuid.UUID(before["id"]), AuditEvent.action == "update"
            )
        )
    )
    assert len(events) == 1
    assert set(events[0].changed_fields) == {"about", "available_from", "rating"}
    assert not any("Новый текст" in str(event.changed_fields) for event in events)


@pytest.mark.parametrize("field", ["first_name", "last_name", "phone"])
def test_required_patch_cannot_be_null(client, t2_db, intake, field):
    staff(client, t2_db)
    created = client.post("/api/v1/candidates", json=manual(intake)).json()
    assert (
        client.patch(
            "/api/v1/candidates/" + created["id"], json={"version": 1, field: None}
        ).status_code
        == 422
    )


def test_duplicate_telegram_or_phone_count_archived_once(client, t2_db, intake):
    staff(client, t2_db)
    a = client.post("/api/v1/candidates", json={**manual(intake), "telegram": "@test"}).json()
    b = client.post(
        "/api/v1/candidates",
        json={**manual(intake), "telegram": "@TEST", "archived_at": datetime.now(UTC).isoformat()},
    ).json()
    c = client.post(
        "/api/v1/candidates", json={**manual(intake), "telegram": "@Test", "phone": "+74951234568"}
    ).json()
    assert b["duplicate_contact_count"] == 1 and c["duplicate_contact_count"] == 2
    assert client.get("/api/v1/candidates/" + a["id"]).json()["duplicate_contact_count"] == 2
    assert client.get("/api/v1/candidates").json()["total"] == 2


def test_staff_fault_atomic(client, t2_db, intake):
    staff(client, t2_db)
    before = client.post("/api/v1/candidates", json=manual(intake)).json()
    error = OperationalError("private", {}, Exception("secret"))
    with patch.object(candidates, "audit", side_effect=error):
        response = client.patch(
            "/api/v1/candidates/" + before["id"], json={"version": 1, "status": "hired"}
        )
    assert response.status_code == 503 and "secret" not in response.text
    assert client.get("/api/v1/candidates/" + before["id"]).json()["version"] == 1


def test_public_delete_cascades_reservations(client, t2_db, intake):
    assert submit(client, intake).status_code == 201
    identifier = t2_db.scalar(select(Candidate.id))
    staff(client, t2_db, "admin")
    assert (
        client.delete(f"/api/v1/candidates/{identifier}", headers={"If-Match": '"1"'}).status_code
        == 204
    )
    assert t2_db.scalar(select(func.count()).select_from(PublicSubmission)) == 0
    assert (
        client.delete(f"/api/v1/candidates/{identifier}", headers={"If-Match": '"1"'}).status_code
        == 404
    )
