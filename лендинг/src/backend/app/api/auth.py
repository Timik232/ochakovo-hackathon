"""Employee authentication. No role/state can be selected by public clients."""

import uuid
from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Employee, PrivacyConfig
from app.models import Session as LoginSession
from app.security.deps import current_employee
from app.security.errors import APIError
from app.security.origin import require_json_origin
from app.security.passwords import hash_password, verify_password
from app.security.sessions import COOKIE_NAME, clear_cookie, create_session, revoke_sessions
from app.services.lifecycle import audit

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
# Fixed cost/format, initialized once, never a real credential.
_FAKE_HASH = hash_password("synthetic timing parity secret")
Password = Annotated[str, Field(min_length=12, max_length=128)]


class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginInput(StrictInput):
    email: str = Field(max_length=254)
    password: Password

    @field_validator("email", mode="before")
    @classmethod
    def normalized_email(cls, value: object) -> str:
        if not isinstance(value, str):
            raise ValueError("Invalid email")
        value = value.strip().lower()
        if len(value) > 254:
            raise ValueError("Invalid email")
        try:
            # Reserved .test domains are valid syntax; no DNS/enumeration network calls.
            validate_email(value, check_deliverability=False, test_environment=True)
        except EmailNotValidError as exc:
            raise ValueError("Invalid email") from exc
        return value


class RegisterInput(LoginInput):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    position: str = Field(min_length=1, max_length=150)

    @field_validator("first_name", "last_name", "position", mode="before")
    @classmethod
    def trimmed(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PasswordInput(StrictInput):
    current_password: Password
    new_password: Password


class Message(BaseModel):
    message: str


class EmployeeView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    position: str
    role: str
    state: str
    must_change_password: bool


class MeView(EmployeeView):
    csrf_token: str


@router.post(
    "/register",
    status_code=201,
    operation_id="auth_register",
    dependencies=[Depends(require_json_origin)],
)
def register(data: RegisterInput, db: Session = Depends(get_db)) -> Message:
    if get_settings().app_env == "production":
        policy = db.get(PrivacyConfig, 1)
        if policy is None or policy.activated_at is None:
            raise APIError(503, "INTAKE_DISABLED", "Регистрация временно недоступна")
    employee = Employee(
        email=data.email,
        first_name=data.first_name,
        last_name=data.last_name,
        position=data.position,
        password_hash=hash_password(data.password),
        role="staff",
        state="pending",
    )
    db.add(employee)
    try:
        db.flush()
        audit(db, "register", employee.id, actor_id=employee.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise APIError(409, "EMAIL_EXISTS", "Этот email уже зарегистрирован") from None
    return Message(message="Регистрация принята. Ожидайте допуска администратора")


@router.post("/login", operation_id="auth_login", dependencies=[Depends(require_json_origin)])
def login(
    data: LoginInput, request: Request, response: Response, db: Session = Depends(get_db)
) -> EmployeeView:
    employee = db.scalar(select(Employee).where(Employee.email == data.email).with_for_update())
    valid = verify_password(data.password, employee.password_hash if employee else _FAKE_HASH)
    if not valid or employee is None:
        raise APIError(401, "INVALID_CREDENTIALS", "Неверный email или пароль")
    if employee.state != "active":
        codes = {
            "pending": "ACCOUNT_PENDING",
            "rejected": "ACCOUNT_REJECTED",
            "disabled": "ACCOUNT_DISABLED",
        }
        raise APIError(403, codes[employee.state], "Доступ к учётной записи пока не предоставлен")
    create_session(db, employee, response, request.cookies.get(COOKIE_NAME))
    audit(db, "login", employee.id, actor_id=employee.id)
    db.commit()
    return EmployeeView.model_validate(employee)


@router.get("/me", operation_id="auth_me")
def me(request: Request, employee: Employee = Depends(current_employee)) -> MeView:
    return MeView(
        **EmployeeView.model_validate(employee).model_dump(),
        csrf_token=request.state.auth_session.csrf_token,
    )


@router.post("/logout", status_code=204, operation_id="auth_logout")
def logout(
    request: Request,
    response: Response,
    employee: Employee = Depends(current_employee),
    db: Session = Depends(get_db),
) -> None:
    db.execute(delete(LoginSession).where(LoginSession.id == request.state.auth_session.id))
    audit(db, "logout", employee.id, actor_id=employee.id)
    db.commit()
    clear_cookie(response)


@router.post(
    "/password",
    status_code=204,
    operation_id="auth_password",
    dependencies=[Depends(require_json_origin)],
)
def password(
    data: PasswordInput,
    response: Response,
    employee: Employee = Depends(current_employee),
    db: Session = Depends(get_db),
) -> None:
    # Re-lock after activity commit; a competing reset/disable must be observed here.
    db.refresh(employee, with_for_update=True)
    if employee.state != "active":
        raise APIError(401, "UNAUTHENTICATED", "Требуется вход в систему")
    if not verify_password(data.current_password, employee.password_hash):
        raise APIError(401, "INVALID_CREDENTIALS", "Неверный текущий пароль")
    employee.password_hash = hash_password(data.new_password)
    employee.must_change_password = False
    revoke_sessions(db, employee.id)
    audit(
        db, "password_change", employee.id, ["password_hash", "must_change_password"], employee.id
    )
    db.commit()
    clear_cookie(response)
