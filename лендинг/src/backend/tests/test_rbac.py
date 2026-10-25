# ruff: noqa: F811
import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Employee
from tests.t2_support import t2_db, t2_engine  # noqa: F401
from tests.test_auth import PASSWORD, account, client, login  # noqa: F401


def protected_routes(client: TestClient) -> None:
    from app.security.deps import current_employee, require_admin

    app = client.app
    assert isinstance(app, FastAPI)

    @app.get("/protected")
    def staff(user: Employee = Depends(current_employee)) -> dict[str, str]:
        return {"role": user.role}

    @app.patch("/protected")
    def mutate(user: Employee = Depends(current_employee)) -> dict[str, str]:
        return {"role": user.role}

    @app.get("/admin-only")
    def admin(user: Employee = Depends(require_admin)) -> dict[str, str]:
        return {"role": user.role}

    @app.get("/limited")
    def limited() -> None:
        raise HTTPException(429, "unsafe internals")


@pytest.mark.parametrize(
    "state,role,login_status,staff_status,admin_status",
    [
        ("pending", "staff", 403, 401, 401),
        ("rejected", "staff", 403, 401, 401),
        ("disabled", "admin", 403, 401, 401),
        ("active", "staff", 200, 200, 403),
        ("active", "admin", 200, 200, 200),
    ],
)
def test_role_matrix(
    client: TestClient,
    t2_db: Session,
    state: str,
    role: str,
    login_status: int,
    staff_status: int,
    admin_status: int,
) -> None:
    protected_routes(client)
    account(t2_db, state, role)
    response = login(client)
    assert response.status_code == login_status
    if login_status != 200:
        assert "set-cookie" not in response.headers
    assert client.get("/protected").status_code == staff_status
    assert client.get("/admin-only").status_code == admin_status


def test_live_disable_and_role_change(client: TestClient, t2_db: Session) -> None:
    protected_routes(client)
    user = account(t2_db, role="admin")
    login(client)
    user.role = "staff"
    t2_db.commit()
    assert client.get("/admin-only").status_code == 403
    user.state = "disabled"
    t2_db.commit()
    assert client.get("/protected").status_code == 401
    user.state = "active"
    t2_db.commit()
    assert client.get("/protected").status_code == 401


def test_must_change_allowlist(client: TestClient, t2_db: Session) -> None:
    protected_routes(client)
    user = account(t2_db, role="admin")
    user.must_change_password = True
    t2_db.commit()
    login(client)
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200 and me.json()["must_change_password"]
    for path in ("/protected", "/admin-only"):
        response = client.get(path)
        assert response.status_code == 403
        assert response.json()["code"] == "CODE_PASSWORD_CHANGE_REQUIRED"
    assert (
        client.post(
            "/api/v1/auth/password",
            json={"current_password": PASSWORD, "new_password": "Новый пароль 789"},
            headers={"X-CSRF-Token": me.json()["csrf_token"]},
        ).status_code
        == 204
    )


def test_mutation_guard_and_unknown_session(client: TestClient, t2_db: Session) -> None:
    protected_routes(client)
    assert (
        client.get("/protected", headers={"Cookie": "ochakovo_session=unknown"}).status_code == 401
    )
    account(t2_db)
    login(client)
    assert client.patch("/protected").status_code == 403
    csrf = client.get("/api/v1/auth/me").json()["csrf_token"]
    assert client.patch("/protected", headers={"X-CSRF-Token": csrf}).status_code == 200
    response = client.get("/limited")
    assert response.status_code == 429 and response.json()["code"] == "RATE_LIMITED"
    assert "unsafe" not in response.text
