"""Administrator access and metadata-only audit; no web role editing/deletion."""

import uuid
from datetime import UTC, date, datetime, time
from enum import IntEnum
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.auth import EmployeeView, Message, Password, StrictInput
from app.db import get_db
from app.models import AuditEvent, Employee
from app.models import Session as LoginSession
from app.security.deps import current_employee, require_admin
from app.security.errors import APIError
from app.security.sessions import COOKIE_NAME, token_hash
from app.services import employees
from app.services.lifecycle import admin_lock

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])
options_router = APIRouter(prefix="/api/v1/employees", tags=["employees"])
Page = Annotated[int, Field(ge=1)]


class PageSize(IntEnum):
    small = 20
    medium = 50
    large = 100


State = Literal["pending", "active", "rejected", "disabled"]
AuditAction = Literal[
    "bootstrap_admin",
    "promote_admin",
    "reset_password",
    "password_change",
    "privacy_activate",
    "intake_disable",
    "retention_delete",
    "create",
    "update",
    "delete",
    "comment",
    "approve",
    "reject",
    "disable",
    "reactivate",
    "register",
    "login",
    "logout",
]


def mutation_admin(request: Request, db: Session = Depends(get_db)) -> Employee:
    # Preflight is NOT authorization: canonical auth/CSRF/state checks run after
    # the advisory lock. Remember a valid in-flight admin solely to distinguish
    # a concurrent disable conflict (409) from a later stale-session request (401).
    token = request.cookies.get(COOKIE_NAME, "")
    now = datetime.now(UTC)
    actor_id = (
        db.scalar(
            select(Employee.id)
            .join(LoginSession)
            .where(
                LoginSession.token_hash == token_hash(token),
                LoginSession.expires_at > now,
                LoginSession.idle_expires_at > now,
                Employee.state == "active",
                Employee.role == "admin",
            )
        )
        if token and len(token) <= 128
        else None
    )
    if actor_id is not None:
        admin_lock(db)  # MUST precede current_employee's actor employee/session locks.
        state = db.scalar(select(Employee.state).where(Employee.id == actor_id))
        if state != "active":
            raise APIError(409, "EMPLOYEE_STATE_CONFLICT", "Состояние сотрудника уже изменено")
    return require_admin(current_employee(request, db))


class AdminEmployee(EmployeeView):
    approved_by: uuid.UUID | None
    approved_at: datetime | None
    created_at: datetime


class EmployeePage(BaseModel):
    items: list[AdminEmployee]
    total: int
    page: int
    page_size: int


class AuditView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    actor_id: uuid.UUID
    entity_id: uuid.UUID
    action: str
    changed_fields: list[str]
    created_at: datetime


class AuditPage(BaseModel):
    items: list[AuditView]
    total: int
    page: int
    page_size: int


class ResetPasswordInput(StrictInput):
    new_password: Password


class StaffOption(BaseModel):
    id: uuid.UUID
    name: str


@router.get("/employees", operation_id="admin_employees")
def list_employees(
    employee: Employee = Depends(require_admin),
    db: Session = Depends(get_db),
    page: Page = 1,
    page_size: PageSize = PageSize.small,
    state: State | None = None,
    q: Annotated[str, Field(max_length=100)] = "",
) -> EmployeePage:
    query = select(Employee)
    if state is not None:
        query = query.where(Employee.state == state)
    if q.strip():
        # autoescape treats %, _ and the escape character as literal input.
        expression = func.replace(
            func.lower(Employee.last_name + " " + Employee.first_name + " " + Employee.email),
            "ё",
            "е",
        )
        query = query.where(
            expression.contains(q.strip().lower().replace("ё", "е"), autoescape=True)
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(Employee.created_at.desc(), Employee.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return EmployeePage(
        items=[AdminEmployee.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/employees/{target_id}/approve", operation_id="admin_employee_approve")
def approve(
    target_id: uuid.UUID, actor: Employee = Depends(mutation_admin), db: Session = Depends(get_db)
) -> AdminEmployee:
    return AdminEmployee.model_validate(employees.change_state(db, actor, target_id, "approve"))


@router.post("/employees/{target_id}/reject", operation_id="admin_employee_reject")
def reject(
    target_id: uuid.UUID, actor: Employee = Depends(mutation_admin), db: Session = Depends(get_db)
) -> AdminEmployee:
    return AdminEmployee.model_validate(employees.change_state(db, actor, target_id, "reject"))


@router.post("/employees/{target_id}/disable", operation_id="admin_employee_disable")
def disable(
    target_id: uuid.UUID, actor: Employee = Depends(mutation_admin), db: Session = Depends(get_db)
) -> AdminEmployee:
    return AdminEmployee.model_validate(employees.change_state(db, actor, target_id, "disable"))


@router.post("/employees/{target_id}/reactivate", operation_id="admin_employee_reactivate")
def reactivate(
    target_id: uuid.UUID, actor: Employee = Depends(mutation_admin), db: Session = Depends(get_db)
) -> AdminEmployee:
    return AdminEmployee.model_validate(employees.change_state(db, actor, target_id, "reactivate"))


@router.post("/employees/{target_id}/reset-password", operation_id="admin_employee_reset_password")
def reset_password(
    target_id: uuid.UUID,
    data: ResetPasswordInput,
    actor: Employee = Depends(mutation_admin),
    db: Session = Depends(get_db),
) -> Message:
    employees.reset_password(db, actor, target_id, data.new_password)
    return Message(message="Пароль изменён. Сотруднику необходимо войти и сменить пароль")


@router.post("/intake/disable", operation_id="admin_intake_disable")
def disable_intake(
    data: StrictInput | None = None,
    actor: Employee = Depends(mutation_admin),
    db: Session = Depends(get_db),
) -> Message:
    employees.disable_intake(db, actor)
    return Message(message="Приём анкет остановлен")


@router.get("/audit", operation_id="admin_audit")
def list_audit(
    employee: Employee = Depends(require_admin),
    db: Session = Depends(get_db),
    page: Page = 1,
    page_size: PageSize = PageSize.small,
    action: AuditAction | None = None,
    actor_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> AuditPage:
    if date_from and date_to and date_from > date_to:
        raise APIError(422, "VALIDATION_ERROR", "Начало периода позже конца")
    query = select(AuditEvent)
    if action:
        query = query.where(AuditEvent.action == action)
    if actor_id:
        query = query.where(AuditEvent.actor_id == actor_id)
    moscow = ZoneInfo("Europe/Moscow")
    if date_from:
        query = query.where(AuditEvent.created_at >= datetime.combine(date_from, time.min, moscow))
    if date_to:
        # Convert to datetime before adding one day: date.max would otherwise overflow.
        end = datetime.combine(date_to, time.max, moscow)
        query = query.where(AuditEvent.created_at <= end)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return AuditPage(
        items=[AuditView.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@options_router.get("/options", operation_id="employee_options")
def staff_options(
    employee: Employee = Depends(current_employee), db: Session = Depends(get_db)
) -> list[StaffOption]:
    rows = db.execute(
        select(Employee.id, Employee.last_name, Employee.first_name)
        .where(Employee.state == "active")
        .order_by(Employee.last_name, Employee.first_name, Employee.id)
    )
    return [StaffOption(id=row.id, name=f"{row.last_name} {row.first_name}") for row in rows]
