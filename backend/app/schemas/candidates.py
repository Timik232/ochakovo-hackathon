"""Separate allowlisted public/staff inputs. No server provenance in writable DTOs."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from urllib.parse import urlsplit

import phonenumbers
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.api.auth import LoginInput, StrictInput
from app.models import normalize_telegram

Status = Literal[
    "application", "new", "review", "interview", "offer", "hired", "reject", "withdrawn"
]
Source = Literal["public_form", "phone", "walk_in", "referral", "job_site", "other"]
StaffSource = Literal["phone", "walk_in", "referral", "job_site", "other"]
Who = Literal["school", "student", "graduate", "working", "other"]
Education = Literal["school", "college", "bachelor", "master", "other"]
Employment = Literal["full", "part", "practice", "internship"]
Name = Annotated[str, Field(min_length=1, max_length=100)]
Age = Annotated[int, Field(ge=14, le=80, strict=True)]
Basis = Literal["candidate_consent", "other_documented_basis"]


class CandidateFields(StrictInput):
    middle_name: Annotated[str, Field(max_length=100)] | None = None
    telegram: Annotated[str, Field(max_length=64)] | None = None
    email: Annotated[str, Field(max_length=254)] | None = None
    edu_level: Education | None = None
    school: Annotated[str, Field(max_length=200)] | None = None
    specialty: Annotated[str, Field(max_length=200)] | None = None
    grad_year: Annotated[int, Field(ge=1950, le=2100, strict=True)] | None = None
    position: Annotated[str, Field(max_length=150)] | None = None
    city: Annotated[str, Field(max_length=100)] | None = None
    employment: Employment | None = None
    start_date: date | None = None
    shifts: Annotated[str, Field(max_length=200)] | None = None
    resume_url: Annotated[str, Field(max_length=500)] | None = None
    experience: Annotated[str, Field(max_length=2000)] | None = None
    about: Annotated[str, Field(max_length=2000)] | None = None
    event: Annotated[str, Field(max_length=100)] | None = None

    @field_validator("*", mode="before")
    @classmethod
    def trim(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("city", "position")
    @classmethod
    def blank_is_none(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("phone", check_fields=False)
    @classmethod
    def normalize_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            number = phonenumbers.parse(value, "RU")
            if not phonenumbers.is_valid_number(number) or number.extension:
                raise ValueError("Invalid phone")
            return str(phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164))
        except phonenumbers.NumberParseException as exc:
            raise ValueError("Invalid phone") from exc

    @field_validator("telegram", mode="before")
    @classmethod
    def telegram_value(cls, value: str | None) -> str | None:
        if value is not None and not isinstance(value, str):
            raise ValueError("Invalid Telegram")
        result = normalize_telegram(value)
        if result and (any(c.isspace() for c in result) or "@" in result[1:]):
            raise ValueError("Invalid Telegram")
        return result

    @field_validator("email")
    @classmethod
    def email_value(cls, value: str | None) -> str | None:
        return LoginInput.normalized_email(value) if value else None

    @field_validator("resume_url")
    @classmethod
    def resume_value(cls, value: str | None) -> str | None:
        if not value:
            return None
        url = urlsplit(value)
        if (
            url.scheme not in ("http", "https")
            or not url.hostname
            or url.username
            or url.password
            or any(c.isspace() for c in value)
        ):
            raise ValueError("Invalid URL")
        try:
            _ = url.port
        except ValueError as exc:
            raise ValueError("Invalid URL") from exc
        return value


class PublicApplication(CandidateFields):
    first_name: Name
    last_name: Name
    phone: str
    age: Age
    who: Who
    vacancy_id: uuid.UUID
    consent: Literal[True]
    privacy_revision: Annotated[int, Field(ge=1, strict=True)]
    website: Annotated[str, Field(max_length=500)] = ""

    @field_validator("consent", mode="before")
    @classmethod
    def explicit_consent(cls, value: object) -> object:
        if value is not True:
            raise ValueError("Consent required")
        return value


class InternalFields(CandidateFields):
    age: Age | None = None
    who: Who | None = None
    vacancy_id: uuid.UUID | None = None
    status: Status = "new"
    department: Annotated[str, Field(max_length=150)] | None = None
    responsible_id: uuid.UUID | None = None
    priority: Literal["normal", "high"] = "normal"
    expected_salary: Annotated[Decimal, Field(ge=0, le=10000000, decimal_places=2)] | None = None
    interview_at: datetime | None = None
    next_contact_at: datetime | None = None
    hot: bool = False
    rating: Annotated[int, Field(ge=0, le=5, strict=True)] = 0
    next_step: Annotated[str, Field(max_length=500)] | None = None
    archived_at: datetime | None = None

    @field_validator("interview_at", "next_contact_at", "archived_at")
    @classmethod
    def aware(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("Timezone required")
        return value


class CandidateCreate(InternalFields):
    first_name: Name
    last_name: Name
    phone: str
    source: StaffSource
    processing_basis: Basis
    processing_basis_note: Annotated[str, Field(max_length=500)] | None = None

    @model_validator(mode="after")
    def documented_basis(self) -> "CandidateCreate":
        if self.processing_basis == "other_documented_basis" and not self.processing_basis_note:
            raise ValueError("Documented basis requires a note")
        return self


class CandidatePatch(InternalFields):
    first_name: Name | None = None
    last_name: Name | None = None
    phone: str | None = None
    version: Annotated[int, Field(ge=1, le=2147483646, strict=True)]


class CandidateView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    first_name: str
    last_name: str
    middle_name: str | None
    phone: str
    telegram: str | None
    email: str | None
    age: int | None
    who: Who | None
    edu_level: Education | None
    school: str | None
    specialty: str | None
    grad_year: int | None
    vacancy_id: uuid.UUID | None
    position: str | None
    city: str | None
    employment: Employment | None
    start_date: date | None = Field(validation_alias="available_from")
    shifts: str | None
    resume_url: str | None
    experience: str | None
    about: str | None
    event: str | None
    status: Status
    source: Source
    department: str | None
    responsible_id: uuid.UUID | None
    priority: Literal["normal", "high"]
    expected_salary: Decimal | None
    interview_at: datetime | None
    next_contact_at: datetime | None
    hot: bool
    rating: int
    next_step: str | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID | None
    updated_by: uuid.UUID | None
    version: int
    processing_basis: Basis
    processing_basis_note: str | None
    consent_at: datetime
    privacy_revision: int
    retention_due_at: datetime
    duplicate_contact_count: int = 0


class CandidatePage(BaseModel):
    items: list[CandidateView]
    total: int
    page: int
    page_size: int


class BulkInput(StrictInput):
    ids: Annotated[list[uuid.UUID], Field(min_length=1, max_length=200)]
    action: Literal["archive", "restore", "stage"]
    stage: Status | None = None

    @model_validator(mode="after")
    def stage_required(self) -> "BulkInput":
        if (self.action == "stage") != (self.stage is not None):
            raise ValueError("Stage is required only for stage action")
        return self


class CommentInput(StrictInput):
    body: Annotated[str, Field(min_length=1, max_length=4000)]

    @field_validator("body", mode="before")
    @classmethod
    def trimmed(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class CommentView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    candidate_id: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    body: str
    author_name: str = ""


class CommentPage(BaseModel):
    items: list[CommentView]
    total: int
    page: int
    page_size: int
