"""Database-only domain mappings; importing these never opens a connection."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, validates

STATUSES = (
    "application",
    "new",
    "review",
    "interview",
    "offer",
    "hired",
    "reject",
    "withdrawn",
)
SOURCES = ("public_form", "phone", "walk_in", "referral", "job_site", "other")
# || and coalesce are immutable, unlike concat_ws. Reuse this exact expression in list queries.
SEARCH_EXPRESSION = (
    "replace(lower(last_name || ' ' || first_name || ' ' || coalesce(middle_name, '') "
    "|| ' ' || coalesce(position, '') || ' ' || coalesce(city, '') "
    "|| ' ' || coalesce(email, '')), 'ё', 'е')"
)


def normalize_telegram(value: str | None) -> str | None:
    """Optional contact, stored with one @; never part of the general search index."""
    nickname = (value or "").strip().lstrip("@").lower()
    return "@" + nickname if nickname else None


class Base(DeclarativeBase):
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_name)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


class Identity:
    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Employee(Identity, Base):
    __tablename__ = "employees"
    email: Mapped[str] = mapped_column(String(254), unique=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    position: Mapped[str] = mapped_column(String(150))
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(10), server_default="staff")
    state: Mapped[str] = mapped_column(String(10), server_default="pending")
    must_change_password: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    approved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (
        CheckConstraint("role IN ('staff','admin')", name="role"),
        CheckConstraint("state IN ('pending','active','rejected','disabled')", name="state"),
        CheckConstraint(
            "email = lower(btrim(email)) AND length(email) > 0", name="email_normalized"
        ),
        CheckConstraint(
            "length(btrim(first_name)) > 0 AND length(btrim(last_name)) > 0 AND length(btrim(position)) > 0",
            name="names",
        ),
    )


class Session(Identity, Base):
    __tablename__ = "sessions"
    employee_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("employees.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_token: Mapped[str] = mapped_column(String(128))
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    idle_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    __table_args__ = (
        CheckConstraint("token_hash ~ '^[0-9a-f]{64}$'", name="token_hash"),
        CheckConstraint("expires_at > created_at AND idle_expires_at <= expires_at", name="expiry"),
    )


class Vacancy(Identity, Base):
    __tablename__ = "vacancies"
    slug: Mapped[str] = mapped_column(String(40), unique=True)
    title: Mapped[str] = mapped_column(String(150))
    dept: Mapped[str] = mapped_column(String(150))
    pay: Mapped[str] = mapped_column(String(100))
    schedule: Mapped[str] = mapped_column(String(200))
    icon: Mapped[str] = mapped_column(String(40))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    sort: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (Index("ix_vacancies_is_active_sort", "is_active", "sort"),)


class Candidate(Identity, Base):
    __tablename__ = "candidates"
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    middle_name: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(16))
    phone_digits: Mapped[str] = mapped_column(
        String(15), Computed("regexp_replace(phone, '[^0-9]', '', 'g')", persisted=True)
    )
    email: Mapped[str | None] = mapped_column(String(254))
    telegram: Mapped[str | None] = mapped_column(String(64))
    age: Mapped[int | None] = mapped_column(Integer)
    who: Mapped[str | None] = mapped_column(String(20))
    edu_level: Mapped[str | None] = mapped_column(String(20))
    school: Mapped[str | None] = mapped_column(String(200))
    specialty: Mapped[str | None] = mapped_column(String(200))
    grad_year: Mapped[int | None] = mapped_column(Integer)
    vacancy_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("vacancies.id", ondelete="RESTRICT"), index=True
    )
    employment: Mapped[str | None] = mapped_column(String(20))
    shifts: Mapped[str | None] = mapped_column(String(200))
    resume_url: Mapped[str | None] = mapped_column(String(500))
    about: Mapped[str | None] = mapped_column(String(2000))
    event: Mapped[str | None] = mapped_column(String(100))
    hot: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    rating: Mapped[int] = mapped_column(Integer, server_default="0")
    next_step: Mapped[str | None] = mapped_column(String(500))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    position: Mapped[str | None] = mapped_column(String(150))
    city: Mapped[str | None] = mapped_column(String(100))
    experience: Mapped[str | None] = mapped_column(String(2000))
    available_from: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), server_default="new", index=True)
    source: Mapped[str] = mapped_column(String(20), index=True)
    department: Mapped[str | None] = mapped_column(String(150))
    responsible_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"), index=True)
    priority: Mapped[str] = mapped_column(String(10), server_default="normal")
    expected_salary: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    interview_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_contact_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("employees.id"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    version: Mapped[int] = mapped_column(Integer, server_default="1")
    processing_basis: Mapped[str] = mapped_column(String(30))
    processing_basis_note: Mapped[str | None] = mapped_column(String(500))
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    privacy_revision: Mapped[int] = mapped_column(Integer)
    retention_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    @validates("telegram")
    def _normalize_telegram(self, key: str, value: str | None) -> str | None:
        return normalize_telegram(value)

    __table_args__ = (
        CheckConstraint("age BETWEEN 14 AND 80", name="age"),
        CheckConstraint("who IN ('school','student','graduate','working','other')", name="who"),
        CheckConstraint(
            "edu_level IN ('school','college','bachelor','master','other')", name="edu_level"
        ),
        CheckConstraint("grad_year BETWEEN 1950 AND 2100", name="grad_year"),
        CheckConstraint(
            "employment IN ('full','part','practice','internship')", name="employment"
        ),
        CheckConstraint("rating BETWEEN 0 AND 5", name="rating"),
        CheckConstraint(
            "telegram = '@' || lower(ltrim(btrim(telegram), '@')) AND telegram ~ '^@[^@[:space:]]+$'",
            name="telegram_normalized",
        ),
        Index("ix_candidates_archived_at", "archived_at", postgresql_where=text("archived_at IS NULL")),
        CheckConstraint(f"status IN {STATUSES}", name="status"),
        CheckConstraint(f"source IN {SOURCES}", name="source"),
        CheckConstraint("priority IN ('normal','high')", name="priority"),
        CheckConstraint("expected_salary BETWEEN 0 AND 10000000", name="salary"),
        CheckConstraint("version > 0 AND privacy_revision > 0", name="versions"),
        CheckConstraint("phone ~ '^\\+[1-9][0-9]{6,14}$'", name="phone"),
        CheckConstraint(
            "length(btrim(first_name)) > 0 AND length(btrim(last_name)) > 0",
            name="names",
        ),
        CheckConstraint(
            "processing_basis IN ('candidate_consent','other_documented_basis')", name="basis"
        ),
        CheckConstraint(
            "processing_basis <> 'other_documented_basis' OR length(btrim(processing_basis_note)) > 0 AND processing_basis_note IS NOT NULL",
            name="basis_note",
        ),
        CheckConstraint(
            "(source = 'public_form' AND created_by IS NULL AND processing_basis = 'candidate_consent') OR (source <> 'public_form' AND created_by IS NOT NULL)",
            name="origin",
        ),
        Index("ix_candidates_created_at_id", "created_at", "id"),
        Index(
            "ix_candidates_search",
            text(SEARCH_EXPRESSION + " gin_trgm_ops"),
            postgresql_using="gin",
        ),
        Index(
            "ix_candidates_phone_digits",
            "phone_digits",
            postgresql_using="gin",
            postgresql_ops={"phone_digits": "gin_trgm_ops"},
        ),
    )


class CandidateComment(Identity, Base):
    __tablename__ = "candidate_comments"
    candidate_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"))
    body: Mapped[str] = mapped_column(String(4000))
    __table_args__ = (
        CheckConstraint("length(btrim(body)) BETWEEN 1 AND 4000", name="body"),
        Index("ix_candidate_comments_order", "candidate_id", "created_at", "id"),
    )


class PublicSubmission(Identity, Base):
    __tablename__ = "public_submissions"
    key_hash: Mapped[str] = mapped_column(String(64), unique=True)
    payload_hmac: Mapped[str] = mapped_column(String(64))
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), index=True
    )
    receipt: Mapped[str] = mapped_column(String(100), server_default="Анкета принята")
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now() + interval '24 hours'"), index=True
    )
    __table_args__ = (
        CheckConstraint(
            "key_hash ~ '^[0-9a-f]{64}$' AND payload_hmac ~ '^[0-9a-f]{64}$'", name="hashes"
        ),
    )


AUDIT_FIELDS = (
    "hot",
    "rating",
    "next_step",
    "archived_at",
    "vacancy_id",
    "telegram",
    "age",
    "who",
    "edu_level",
    "school",
    "specialty",
    "grad_year",
    "employment",
    "shifts",
    "resume_url",
    "about",
    "event",
    "first_name",
    "last_name",
    "middle_name",
    "phone",
    "email",
    "position",
    "city",
    "experience",
    "available_from",
    "status",
    "source",
    "department",
    "responsible_id",
    "priority",
    "expected_salary",
    "interview_at",
    "next_contact_at",
    "role",
    "state",
    "password_hash",
    "must_change_password",
    "collection_enabled",
    "revision",
    "retention_days",
    "notice",
    "consent",
    "operator_identity",
    "processing_basis",
    "processing_basis_note",
)


class AuditEvent(Identity, Base):
    __tablename__ = "audit_events"
    # Deliberately no FK: retention/admin deletion must not erase the audit fact.
    actor_id: Mapped[uuid.UUID] = mapped_column(index=True)
    action: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[uuid.UUID] = mapped_column(index=True)
    changed_fields: Mapped[list[str]] = mapped_column(
        ARRAY(Text), server_default=text("'{}'::text[]")
    )
    __table_args__ = (
        CheckConstraint(
            "action IN ('bootstrap_admin','promote_admin','reset_password','password_change','privacy_activate','intake_disable','retention_delete','create','update','delete','comment','approve','reject','disable','reactivate','register','login','logout')",
            name="action",
        ),
        CheckConstraint(
            "changed_fields <@ ARRAY["
            + ",".join("'" + name + "'" for name in AUDIT_FIELDS)
            + "]::text[]",
            name="field_names",
        ),
        Index("ix_audit_events_created_at_id", "created_at", "id"),
    )


class PrivacyConfig(Base):
    __tablename__ = "privacy_config"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, server_default="1")
    collection_enabled: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    operator_identity: Mapped[str | None] = mapped_column(Text)
    notice: Mapped[str | None] = mapped_column(Text)
    consent: Mapped[str | None] = mapped_column(Text)
    revision: Mapped[int] = mapped_column(Integer, server_default="0")
    retention_days: Mapped[int | None] = mapped_column(Integer)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    __table_args__ = (
        CheckConstraint("id = 1", name="singleton"),
        CheckConstraint("retention_days BETWEEN 1 AND 365", name="retention"),
        CheckConstraint("revision >= 0", name="revision"),
        CheckConstraint(
            "NOT collection_enabled OR (length(btrim(operator_identity)) > 0 AND operator_identity IS NOT NULL AND length(btrim(notice)) > 0 AND notice IS NOT NULL AND length(btrim(consent)) > 0 AND consent IS NOT NULL AND revision > 0 AND retention_days IS NOT NULL AND activated_at IS NOT NULL)",
            name="activation",
        ),
    )
