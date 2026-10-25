"""Reusable current DB-state authorization; every authenticated mutation checks CSRF."""

from datetime import UTC, datetime

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Employee
from app.models import Session as LoginSession
from app.security.csrf import require_csrf
from app.security.errors import APIError
from app.security.sessions import COOKIE_NAME, IDLE_TTL, revoke_sessions, token_hash

_PASSWORD_ALLOWLIST = {
    ("GET", "/api/v1/auth/me"),
    ("POST", "/api/v1/auth/password"),
    ("POST", "/api/v1/auth/logout"),
}


def current_employee(request: Request, db: Session = Depends(get_db)) -> Employee:
    token = request.cookies.get(COOKIE_NAME)
    session = (
        db.scalar(select(LoginSession).where(LoginSession.token_hash == token_hash(token)))
        if token and len(token) <= 128
        else None
    )
    now = datetime.now(UTC)
    if session is None:
        raise APIError(401, "UNAUTHENTICATED", "Требуется вход в систему")
    if session.expires_at <= now or session.idle_expires_at <= now:
        db.delete(session)
        db.commit()
        raise APIError(401, "UNAUTHENTICATED", "Требуется вход в систему")
    # Lock employee through mutation to serialize password changes against new logins.
    employee = db.scalar(
        select(Employee)
        .where(Employee.id == session.employee_id)
        .execution_options(populate_existing=True)
        .with_for_update()
    )
    if employee is None or employee.state != "active":
        revoke_sessions(db, session.employee_id)
        db.commit()
        raise APIError(401, "UNAUTHENTICATED", "Требуется вход в систему")
    # Recheck after employee lock: password reset/logout may have revoked the
    # initially observed session while this request waited for that lock.
    session = db.scalar(
        select(LoginSession)
        .where(LoginSession.token_hash == token_hash(token or ""))
        .execution_options(populate_existing=True)
        .with_for_update()
    )
    if session is None:
        raise APIError(401, "UNAUTHENTICATED", "Требуется вход в систему")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        require_csrf(request, session)
    if (
        employee.must_change_password
        and (request.method, request.url.path) not in _PASSWORD_ALLOWLIST
    ):
        raise APIError(403, "CODE_PASSWORD_CHANGE_REQUIRED", "Необходимо сменить пароль")
    session.last_seen_at = now
    session.idle_expires_at = min(now + IDLE_TTL, session.expires_at)
    request.state.auth_session = session
    # get_db commits reads too; keep locks until the handler's transaction ends.
    db.flush()
    return employee


def require_admin(employee: Employee = Depends(current_employee)) -> Employee:
    if employee.role != "admin":
        raise APIError(403, "FORBIDDEN", "Недостаточно прав")
    return employee
