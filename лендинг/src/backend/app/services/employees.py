"""Employee lifecycle; caller owns the transaction and authenticates the actor.

Lock order for admin mutations: ADMIN_LOCK -> actor employee/session -> target
employee -> target sessions. Take ADMIN_LOCK before authenticating/locking the
actor, not just inside disable: two admins can otherwise deadlock each other.
"""

import uuid
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Employee, PrivacyConfig
from app.security.errors import APIError
from app.security.passwords import hash_password
from app.security.sessions import revoke_sessions
from app.services.lifecycle import (
    SYSTEM_ACTOR,
    LifecycleError,
    admin_lock,
    audit,
    ensure_not_last_admin,
)

EmployeeAction = Literal["approve", "reject", "disable", "reactivate"]


def change_state(
    db: Session, actor: Employee, target_id: uuid.UUID, action: EmployeeAction
) -> Employee:
    admin_lock(db)
    target = locked_employee(db, target_id)
    allowed = {
        "approve": {"pending", "rejected"},
        "reject": {"pending"},
        "disable": {"active"},
        "reactivate": {"disabled"},
    }
    if target.state not in allowed[action]:
        raise APIError(409, "EMPLOYEE_STATE_CONFLICT", "Состояние сотрудника уже изменено")
    if action == "disable":
        try:
            ensure_not_last_admin(db, target)
        except LifecycleError:
            raise APIError(
                409, "LAST_ADMIN", "Нельзя отключить последнего администратора"
            ) from None
        revoke_sessions(db, target.id)
    target.state = {
        "approve": "active",
        "reactivate": "active",
        "reject": "rejected",
        "disable": "disabled",
    }[action]
    if action in {"approve", "reactivate"}:
        target.approved_by, target.approved_at = actor.id, datetime.now(UTC)
    audit(db, action, target.id, ["state"], actor.id)
    db.flush()
    return target


def locked_employee(db: Session, target_id: uuid.UUID) -> Employee:
    target = db.scalar(
        select(Employee)
        .where(Employee.id == target_id)
        .execution_options(populate_existing=True)
        .with_for_update()
    )
    if target is None:
        raise APIError(404, "EMPLOYEE_NOT_FOUND", "Сотрудник не найден")
    return target


def reset_password(db: Session, actor: Employee, target_id: uuid.UUID, new_password: str) -> None:
    admin_lock(db)
    target = locked_employee(db, target_id)
    target.password_hash = hash_password(new_password)
    target.must_change_password = True
    revoke_sessions(db, target.id)
    audit(db, "reset_password", target.id, ["password_hash", "must_change_password"], actor.id)
    db.flush()


def disable_intake(db: Session, actor: Employee) -> None:
    # One-way web kill switch. Only CLI privacy-activate can enable/re-enable.
    config = db.scalar(select(PrivacyConfig).where(PrivacyConfig.id == 1).with_for_update())
    if config is None:
        raise APIError(503, "PRIVACY_UNAVAILABLE", "Настройки приёма недоступны")
    config.collection_enabled = False
    audit(db, "intake_disable", SYSTEM_ACTOR, ["collection_enabled"], actor.id)
    db.flush()
