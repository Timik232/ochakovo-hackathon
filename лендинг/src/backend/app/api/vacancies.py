"""Shared vacancy catalogue. Deactivate instead of deleting; slug is immutable."""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import StrictInput
from app.db import get_db
from app.models import Employee, Vacancy
from app.security.deps import current_employee
from app.security.errors import APIError
from app.services.lifecycle import audit

router = APIRouter(prefix="/api/v1/vacancies", tags=["vacancies"])


class VacancyFields(StrictInput):
    title: Annotated[str, Field(min_length=1, max_length=150)]
    dept: Annotated[str, Field(max_length=150)] = ""
    pay: Annotated[str, Field(max_length=100)] = ""
    schedule: Annotated[str, Field(max_length=200)] = ""
    icon: Annotated[str, Field(max_length=40)] = ""
    is_active: bool = True
    sort: int = 0

    @field_validator("*", mode="before")
    @classmethod
    def trim(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class VacancyCreate(VacancyFields):
    slug: Annotated[str, Field(min_length=1, max_length=40, pattern=r"^[a-z0-9][a-z0-9-]*$")]


class VacancyPatch(VacancyFields):
    title: Annotated[str, Field(min_length=1, max_length=150)] = "Вакансия"


class VacancyView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    slug: str
    title: str
    dept: str
    pay: str
    schedule: str
    icon: str
    is_active: bool
    sort: int
    created_at: datetime
    updated_at: datetime


@router.get("", operation_id="vacancies_list")
def list_vacancies(
    actor: Employee = Depends(current_employee), db: Session = Depends(get_db)
) -> list[VacancyView]:
    return [
        VacancyView.model_validate(row)
        for row in db.scalars(select(Vacancy).order_by(Vacancy.sort, Vacancy.id))
    ]


@router.post("", status_code=201, operation_id="vacancies_create")
def create_vacancy(
    data: VacancyCreate, actor: Employee = Depends(current_employee), db: Session = Depends(get_db)
) -> VacancyView:
    row = Vacancy(**data.model_dump())
    db.add(row)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise APIError(409, "VACANCY_SLUG_EXISTS", "Такой код вакансии уже существует") from None
    # Vacancy attributes are NOT in the immutable DB audit allowlist; fact/entity/actor only.
    audit(db, "create", row.id, actor_id=actor.id)
    result = VacancyView.model_validate(row)
    db.commit()
    return result


@router.patch("/{vacancy_id}", operation_id="vacancies_update")
def update_vacancy(
    vacancy_id: uuid.UUID,
    data: VacancyPatch,
    actor: Employee = Depends(current_employee),
    db: Session = Depends(get_db),
) -> VacancyView:
    row = db.scalar(select(Vacancy).where(Vacancy.id == vacancy_id).with_for_update())
    if row is None:
        raise APIError(404, "NOT_FOUND", "Вакансия не найдена")
    for name, value in data.model_dump(exclude_unset=True).items():
        setattr(row, name, value)
    audit(db, "update", row.id, actor_id=actor.id)
    db.flush()
    db.refresh(row)
    result = VacancyView.model_validate(row)
    db.commit()
    return result
