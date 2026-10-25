"""Opaque sessions, SHA256 at rest, fixed 24h absolute and sliding 8h idle TTL."""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Response
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Employee
from app.models import Session as LoginSession

COOKIE_NAME = "ochakovo_session"
IDLE_TTL = timedelta(hours=8)
ABSOLUTE_TTL = timedelta(hours=24)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def revoke_sessions(db: Session, employee_id: uuid.UUID) -> None:
    """T4 must invoke in the same transaction as disable/reset-password."""
    db.execute(delete(LoginSession).where(LoginSession.employee_id == employee_id))


def cookie_secure() -> bool:
    # Settings permits an explicit HTTP opt-in only in disposable environments.
    return get_settings().cookie_secure


def clear_cookie(response: Response) -> None:
    response.delete_cookie(
        COOKIE_NAME, path="/", secure=cookie_secure(), httponly=True, samesite="lax"
    )


def create_session(
    db: Session, employee: Employee, response: Response, previous_token: str | None
) -> None:
    # Rotate the caller's old session, not unrelated devices of the same employee.
    if previous_token:
        db.execute(
            delete(LoginSession).where(LoginSession.token_hash == token_hash(previous_token))
        )
    now = datetime.now(UTC)
    token = secrets.token_urlsafe(32)
    db.add(
        LoginSession(
            employee_id=employee.id,
            token_hash=token_hash(token),
            csrf_token=secrets.token_urlsafe(32),
            created_at=now,
            last_seen_at=now,
            idle_expires_at=now + IDLE_TTL,
            expires_at=now + ABSOLUTE_TTL,
        )
    )
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=int(ABSOLUTE_TTL.total_seconds()),
        secure=cookie_secure(),
        httponly=True,
        samesite="lax",
        path="/",
    )
