"""Candidate queries and transactional mutations; caller commits after building responses."""

import re
import uuid
from datetime import date, datetime, time
from typing import Any, Literal
from zoneinfo import ZoneInfo

from pydantic import Field
from sqlalchemy import Select, Text, case, func, literal_column, or_, select, update
from sqlalchemy.orm import Session

from app.api.admin import PageSize
from app.api.auth import StrictInput
from app.config import get_settings
from app.models import SEARCH_EXPRESSION, STATUSES, Candidate, Employee, PrivacyConfig, Vacancy
from app.schemas.candidates import CandidateFields, CandidateView, Source, Status
from app.security.errors import APIError
from app.services.lifecycle import duplicate_contact_count

MOSCOW = ZoneInfo("Europe/Moscow")


class CandidateFilters(StrictInput):
    q: str = Field(default="", max_length=100)
    status: list[Status] = Field(default_factory=list, alias="status[]")
    source: list[Source] = Field(default_factory=list, alias="source[]")
    responsible_id: list[uuid.UUID | Literal["unassigned"]] = Field(
        default_factory=list, alias="responsible_id[]"
    )
    priority: list[Literal["normal", "high"]] = Field(default_factory=list, alias="priority[]")
    vacancy_id: list[uuid.UUID] = Field(default_factory=list, alias="vacancy_id[]")
    hot: bool | None = None
    archived: Literal["0", "1", "all"] = "0"
    city: str | None = Field(default=None, max_length=100)
    position: str | None = Field(default=None, max_length=150)
    created_from: date | None = None
    created_to: date | None = None
    sort: Literal["created_at", "updated_at", "last_name", "status", "next_contact_at"] = (
        "created_at"
    )
    direction: Literal["asc", "desc"] = "desc"
    page: int = Field(default=1, ge=1, le=2147483647)
    page_size: PageSize = PageSize.small


def normalized(value: str) -> str:
    return value.strip().lower().replace("ё", "е")


def query_candidates(filters: CandidateFilters) -> Select[tuple[Candidate]]:
    if filters.created_from and filters.created_to and filters.created_from > filters.created_to:
        raise APIError(422, "VALIDATION_ERROR", "Начало периода позже конца")
    query = select(Candidate)
    if filters.archived != "all":
        query = query.where(
            Candidate.archived_at.is_(None)
            if filters.archived == "0"
            else Candidate.archived_at.is_not(None)
        )
    if filters.q.strip():
        # The indexed expression is shared with the model; qualify its fixed identifiers
        # because CSV joins employees, which also has first_name/last_name columns.
        search_expression = re.sub(
            r"\b(last_name|first_name|middle_name|position|city|email)\b",
            r"candidates.\1",
            SEARCH_EXPRESSION,
        )
        expression = literal_column(search_expression, type_=Text)
        matches = [expression.contains(normalized(filters.q), autoescape=True)]
        digits = "".join(c for c in filters.q if c in "0123456789")
        if len(digits) >= 3:
            matches.append(Candidate.phone_digits.contains(digits, autoescape=True))
        query = query.where(or_(*matches))
    for name in ("status", "source", "priority", "vacancy_id"):
        values = getattr(filters, name)
        if values:
            query = query.where(getattr(Candidate, name).in_(values))
    if filters.responsible_id:
        ids = [value for value in filters.responsible_id if isinstance(value, uuid.UUID)]
        matches = [Candidate.responsible_id.in_(ids)]
        if "unassigned" in filters.responsible_id:
            matches.append(Candidate.responsible_id.is_(None))
        query = query.where(or_(*matches))
    if filters.hot is not None:
        query = query.where(Candidate.hot == filters.hot)
    if filters.city is not None:
        query = query.where(
            func.replace(func.lower(Candidate.city), "ё", "е") == normalized(filters.city)
        )
    if filters.position is not None:
        query = query.where(
            func.replace(func.lower(Candidate.position), "ё", "е").contains(
                normalized(filters.position), autoescape=True
            )
        )
    if filters.created_from:
        query = query.where(
            Candidate.created_at >= datetime.combine(filters.created_from, time.min, MOSCOW)
        )
    if filters.created_to:
        query = query.where(
            Candidate.created_at <= datetime.combine(filters.created_to, time.max, MOSCOW)
        )
    return query


def sorted_query(
    query: Select[tuple[Candidate]], filters: CandidateFilters
) -> Select[tuple[Candidate]]:
    column = (
        case({s: i for i, s in enumerate(STATUSES)}, value=Candidate.status)
        if filters.sort == "status"
        else getattr(Candidate, filters.sort)
    )
    if filters.sort == "last_name":
        column = func.replace(func.lower(Candidate.last_name), "ё", "е")
    order = column.asc() if filters.direction == "asc" else column.desc()
    return query.order_by(order.nulls_last(), Candidate.id.desc())


def policy_for_intake(db: Session) -> PrivacyConfig:
    # Same SHARE lock as candidate_lifecycle; a kill switch/revision update waits for intake commit.
    policy = db.scalar(
        select(PrivacyConfig).where(PrivacyConfig.id == 1).with_for_update(read=True)
    )
    if policy is None or not policy.collection_enabled:
        raise APIError(503, "INTAKE_DISABLED", "Приём анкет временно остановлен")
    return policy


def mutation_allowed(db: Session) -> None:
    if get_settings().app_env == "production":
        policy = db.get(PrivacyConfig, 1)
        if policy is None or policy.activated_at is None:
            raise APIError(503, "INTAKE_DISABLED", "Обработка анкет пока недоступна")


def validate_references(db: Session, values: dict[str, Any], *, public: bool = False) -> None:
    if values.get("vacancy_id") is not None:
        vacancy = db.scalar(
            select(Vacancy).where(Vacancy.id == values["vacancy_id"]).with_for_update(read=True)
        )
        if vacancy is None or (public and not vacancy.is_active):
            raise APIError(422, "VALIDATION_ERROR", "Выбери доступную вакансию")
    if values.get("responsible_id") is not None:
        # Auth owns actor locks; avoid locking a second employee here (cross-assignment deadlock).
        state = db.scalar(select(Employee.state).where(Employee.id == values["responsible_id"]))
        if state != "active":
            raise APIError(422, "VALIDATION_ERROR", "Выбери активного ответственного")


def validate_start(data: CandidateFields) -> None:
    if data.start_date is not None and data.start_date < datetime.now(MOSCOW).date():
        raise APIError(422, "VALIDATION_ERROR", "Выбери сегодняшнюю или будущую дату")


def storage_values(values: dict[str, Any]) -> dict[str, Any]:
    if "start_date" in values:
        values["available_from"] = values.pop("start_date")
    # v3: city/position are optional — absent/blank values are stored as NULL,
    # never as placeholder labels.
    for name in ("city", "position"):
        if name in values and not values[name]:
            values[name] = None
    return values


def get_candidate(db: Session, identifier: uuid.UUID) -> Candidate:
    row = db.get(Candidate, identifier)
    if row is None:
        raise APIError(404, "NOT_FOUND", "Кандидат не найден")
    return row


def detail(db: Session, row: Candidate) -> CandidateView:
    result = CandidateView.model_validate(row)
    result.duplicate_contact_count = duplicate_contact_count(
        db, phone=row.phone, telegram=row.telegram, exclude_id=row.id
    )
    return result


def versioned_update(
    db: Session, identifier: uuid.UUID, version: int, values: dict[str, Any]
) -> Candidate:
    get_candidate(db, identifier)
    changed = db.scalar(
        update(Candidate)
        .where(Candidate.id == identifier, Candidate.version == version)
        .values(**values, version=Candidate.version + 1)
        .returning(Candidate.id)
        .execution_options(synchronize_session=False)
    )
    if changed is None:
        raise APIError(409, "VERSION_CONFLICT", "Карточка уже изменена. Загрузи актуальную версию")
    db.expire_all()
    return get_candidate(db, identifier)
