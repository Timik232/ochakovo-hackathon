# ruff: noqa: F811
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.main import create_app
from app.models import Employee
from app.models import Session as LoginSession
from app.security.passwords import hash_password
from tests.t2_support import employee, policy, t2_db, t2_engine  # noqa: F401

ORIGIN = "https://example.test"
PASSWORD = "тестовый пароль 123"
REGISTER = {
    "email": " Irina.Staff@example.test ",
    "first_name": " Ирина ",
    "last_name": "Тестова",
    "position": "Инженер",
    "password": PASSWORD,
}


@pytest.fixture
def client(t2_db: Session) -> Iterator[TestClient]:
    settings = get_settings()
    with patch.object(settings, "app_origin", ORIGIN), patch.object(settings, "app_env", "test"):
        app = create_app()
        def request_db() -> Iterator[Session]:
            try:
                yield t2_db
                t2_db.commit()
            except Exception:
                t2_db.rollback()
                raise

        app.dependency_overrides[get_db] = request_db
        with TestClient(app, base_url=ORIGIN, headers={"Origin": ORIGIN}) as result:
            yield result


def account(db: Session, state: str = "active", role: str = "staff") -> Employee:
    item = employee(db, role=role)
    item.password_hash = hash_password(PASSWORD)
    item.state = state
    db.commit()
    return item


def login(client: TestClient) -> Response:
    return client.post(
        "/api/v1/auth/login", json={"email": "operator@example.test", "password": PASSWORD}
    )


def test_registration_pending_then_approval(client: TestClient, t2_db: Session) -> None:
    policy(t2_db)
    t2_db.commit()
    response = client.post("/api/v1/auth/register", json=REGISTER)
    assert response.status_code == 201
    assert "set-cookie" not in response.headers
    user = t2_db.scalar(select(Employee))
    assert user and user.email == "irina.staff@example.test" and user.role == "staff"
    assert user.first_name == "Ирина" and user.state == "pending"
    payload = {"email": user.email, "password": PASSWORD}
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 403 and response.json()["code"] == "ACCOUNT_PENDING"
    assert "set-cookie" not in response.headers
    user.state = "active"
    t2_db.commit()
    assert client.post("/api/v1/auth/login", json=payload).status_code == 200
    assert client.get("/api/v1/auth/me").json()["role"] == "staff"
    assert client.post("/api/v1/auth/register", json=REGISTER).status_code == 409


@pytest.mark.parametrize("field", ["role", "state", "approved_by", "created_at"])
def test_register_forbids_privilege_fields(client: TestClient, field: str) -> None:
    response = client.post("/api/v1/auth/register", json={**REGISTER, field: "admin"})
    assert response.status_code == 422
    assert "password" not in response.text and "admin" not in response.text


@pytest.mark.parametrize(
    "field,value",
    [
        ("email", "invalid"),
        ("first_name", " "),
        ("last_name", "x" * 101),
        ("position", "x" * 151),
        ("password", "short"),
        ("password", "x" * 129),
        ("email", "x" * 255 + "@example.test"),
    ],
)
def test_registration_validation(client: TestClient, field: str, value: str) -> None:
    assert client.post("/api/v1/auth/register", json={**REGISTER, field: value}).status_code == 422


def test_secure_cookie_rotation_and_logout(client: TestClient, t2_db: Session) -> None:
    account(t2_db)
    response = login(client)
    assert response.status_code == 200
    cookie = response.headers["set-cookie"]
    assert "Secure" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert "Domain=" not in cookie and "Path=/" in cookie
    old = client.cookies.get("ochakovo_session")
    row = t2_db.scalar(select(LoginSession))
    assert row and row.token_hash != old and len(row.token_hash) == 64
    assert (
        timedelta(hours=23, minutes=59)
        < row.expires_at - row.created_at
        < timedelta(hours=24, minutes=1)
    )
    assert (
        timedelta(hours=7, minutes=59)
        < row.idle_expires_at - row.created_at
        < timedelta(hours=8, minutes=1)
    )
    assert login(client).status_code == 200
    assert (
        client.get("/api/v1/auth/me", headers={"Cookie": f"ochakovo_session={old}"}).status_code
        == 401
    )
    csrf = client.get("/api/v1/auth/me").json()["csrf_token"]
    current = client.cookies.get("ochakovo_session")
    assert client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf}).status_code == 204
    assert (
        client.get("/api/v1/auth/me", headers={"Cookie": f"ochakovo_session={current}"}).status_code
        == 401
    )


@pytest.mark.parametrize(
    "headers", [{}, {"X-CSRF-Token": "wrong"}, {"Origin": "https://foreign.test"}]
)
def test_csrf_rejects(client: TestClient, t2_db: Session, headers: dict[str, str]) -> None:
    account(t2_db)
    login(client)
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 403


@pytest.mark.parametrize("column", ["idle_expires_at", "expires_at"])
def test_expiry(client: TestClient, t2_db: Session, column: str) -> None:
    account(t2_db)
    login(client)
    row = t2_db.scalar(select(LoginSession))
    assert row
    row.created_at = datetime.now(UTC) - timedelta(days=2)
    row.idle_expires_at = datetime.now(UTC) - timedelta(seconds=2)
    setattr(row, column, datetime.now(UTC) - timedelta(seconds=1))
    t2_db.commit()
    assert client.get("/api/v1/auth/me").status_code == 401


def test_unknown_and_wrong_password_same_error(client: TestClient, t2_db: Session) -> None:
    account(t2_db)
    from app.api import auth

    with patch.object(auth, "verify_password", wraps=auth.verify_password) as verifier:
        a = client.post(
            "/api/v1/auth/login", json={"email": "absent@example.test", "password": PASSWORD}
        )
        b = client.post(
            "/api/v1/auth/login",
            json={"email": "operator@example.test", "password": "incorrect password"},
        )
    assert verifier.call_count == 2
    assert a.status_code == b.status_code == 401
    assert a.json()["code"] == b.json()["code"]
    assert a.json()["message"] == b.json()["message"]
    assert t2_db.scalar(select(func.count()).select_from(LoginSession)) == 0


def test_password_change_revokes_all(client: TestClient, t2_db: Session) -> None:
    user = account(t2_db)
    login(client)
    first = client.cookies.get("ochakovo_session")
    client.cookies.clear()
    login(client)
    csrf = client.get("/api/v1/auth/me").json()["csrf_token"]
    body = {"current_password": PASSWORD, "new_password": "Новый пароль 456"}
    assert (
        client.post(
            "/api/v1/auth/password",
            json={**body, "current_password": "wrong password"},
            headers={"X-CSRF-Token": csrf},
        ).status_code
        == 401
    )
    assert (
        client.post("/api/v1/auth/password", json=body, headers={"X-CSRF-Token": csrf}).status_code
        == 204
    )
    assert not user.must_change_password
    assert t2_db.scalar(select(func.count()).select_from(LoginSession)) == 0
    assert (
        client.get("/api/v1/auth/me", headers={"Cookie": f"ochakovo_session={first}"}).status_code
        == 401
    )


def test_origin_json_and_error_safety(client: TestClient) -> None:
    assert (
        client.post("/api/v1/auth/login", json=REGISTER, headers={"Origin": "null"}).status_code
        == 403
    )
    client.headers.pop("Origin")
    assert client.post("/api/v1/auth/login", json=REGISTER).status_code == 403
    response = client.post(
        "/api/v1/auth/login",
        content="secret",
        headers={"Origin": ORIGIN, "Content-Type": "text/plain"},
    )
    assert response.status_code == 415
    assert response.json()["request_id"] == response.headers["x-request-id"]
    assert "secret" not in response.text


def test_production_registration_gate(client: TestClient) -> None:
    with patch.object(get_settings(), "app_env", "production"):
        assert client.post("/api/v1/auth/register", json=REGISTER).status_code == 503
