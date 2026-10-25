"""Transactional operator lifecycle. Callers own commit/rollback boundaries."""

import hashlib
import hmac
import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlsplit

from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.orm import Session

from app.models import (
    AuditEvent,
    Candidate,
    Employee,
    PrivacyConfig,
    PublicSubmission,
    normalize_telegram,
)
from app.models import Session as EmployeeSession

# Stable shared transaction-scoped namespaces; T3/T4 must use ADMIN_LOCK too.
ADMIN_LOCK = 0x4F434841444D494E
CLEANUP_LOCK = 0x4F4348434C45414E
SYSTEM_ACTOR = uuid.UUID("00000000-0000-0000-0000-000000000001")


def duplicate_contact_count(
    db: Session,
    *,
    phone: str | None = None,
    telegram: str | None = None,
    exclude_id: uuid.UUID | None = None,
) -> int:
    """Staff-only warning helper: OR contacts, count each row once, include archived rows.

    Input phone should be validated E.164 by the API; punctuation is ignored here.
    Never expose this count in public intake responses.
    """
    matches = []
    digits = "".join(c for c in (phone or "") if c in "0123456789")
    if digits:
        matches.append(Candidate.phone_digits == digits)
    normalized = normalize_telegram(telegram)
    if normalized:
        matches.append(func.lower(func.ltrim(Candidate.telegram, "@")) == normalized[1:])
    if not matches:
        return 0
    query = select(func.count()).select_from(Candidate).where(or_(*matches))
    if exclude_id is not None:
        query = query.where(Candidate.id != exclude_id)
    return db.scalar(query) or 0


class LifecycleError(ValueError):
    """Safe operator-facing error; never includes secrets or candidate content."""


def admin_lock(db: Session) -> None:
    db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": ADMIN_LOCK})


def ensure_not_last_admin(db: Session, employee: Employee) -> None:
    """Must be called in the same transaction as the disable/demotion mutation."""
    admin_lock(db)
    db.refresh(employee)
    if employee.role == "admin" and employee.state == "active":
        count = db.scalar(
            select(func.count())
            .select_from(Employee)
            .where(Employee.role == "admin", Employee.state == "active")
        )
        if count is None or count <= 1:
            raise LifecycleError("Cannot disable the last active admin")


def audit(
    db: Session,
    action: str,
    entity_id: uuid.UUID,
    fields: list[str] | None = None,
    actor_id: uuid.UUID = SYSTEM_ACTOR,
) -> None:
    db.add(
        AuditEvent(
            actor_id=actor_id, action=action, entity_id=entity_id, changed_fields=fields or []
        )
    )


def activate_privacy(
    db: Session,
    *,
    operator_identity: str,
    notice: str,
    consent: str,
    revision: int,
    retention_days: int,
    authorized: bool,
    origin: str,
    allow_http_origin: bool = False,
) -> PrivacyConfig:
    from app.config import get_settings

    if allow_http_origin and get_settings().app_env not in {"test", "development"}:
        raise LifecycleError("HTTP origin is allowed only test or development")
    url = urlsplit(origin)
    if (
        not authorized
        or url.scheme not in ({"https", "http"} if allow_http_origin else {"https"})
        or not url.hostname
        or url.username
        or url.password
        or url.query
        or url.fragment
        or url.path not in ("", "/")
    ):
        raise LifecycleError("Activation requires authority and a verified HTTPS APP_ORIGIN")
    if not all(value.strip() for value in (operator_identity, notice, consent)):
        raise LifecycleError("Operator, notice and consent must be nonempty")
    if not 1 <= retention_days <= 365 or revision < 1:
        raise LifecycleError("Invalid retention or revision")
    policy = db.scalar(select(PrivacyConfig).where(PrivacyConfig.id == 1).with_for_update())
    if policy is None:
        raise LifecycleError("Privacy configuration missing: run migrations")
    changed_text = (operator_identity, notice, consent) != (
        policy.operator_identity,
        policy.notice,
        policy.consent,
    )
    if revision < policy.revision or (changed_text and revision <= policy.revision):
        raise LifecycleError("Text changes require a higher privacy revision")
    policy.operator_identity, policy.notice, policy.consent = operator_identity, notice, consent
    policy.revision, policy.retention_days = revision, retention_days
    policy.collection_enabled = True
    policy.activated_at = datetime.now(UTC)
    audit(
        db,
        "privacy_activate",
        SYSTEM_ACTOR,
        [
            "collection_enabled",
            "revision",
            "retention_days",
            "notice",
            "consent",
            "operator_identity",
        ],
    )
    db.flush()
    return policy


def cleanup(db: Session, *, now: datetime | None = None) -> dict[str, int]:
    if not db.scalar(text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": CLEANUP_LOCK}):
        raise LifecycleError("Cleanup already running")
    cutoff = now or datetime.now(UTC)
    if cutoff.tzinfo is None:
        raise LifecycleError("Cleanup cutoff must be timezone-aware")
    expired = list(
        db.scalars(
            delete(Candidate).where(Candidate.retention_due_at <= cutoff).returning(Candidate.id)
        )
    )
    for candidate_id in expired:
        audit(db, "retention_delete", candidate_id)
    counts = {"candidates": len(expired)}
    for name, model, predicate in (
        ("submissions", PublicSubmission, PublicSubmission.expires_at <= cutoff),
        (
            "sessions",
            EmployeeSession,
            or_(EmployeeSession.expires_at <= cutoff, EmployeeSession.idle_expires_at <= cutoff),
        ),
        ("audit", AuditEvent, AuditEvent.created_at <= cutoff - timedelta(days=180)),
    ):
        counts[name] = len(list(db.scalars(delete(model).where(predicate).returning(model.id))))
    db.flush()
    return counts


def submission_fingerprints(
    key: uuid.UUID, validated_payload: dict[str, Any], secret: bytes
) -> tuple[str, str]:
    """Use validated JSON-mode DTO data; a keyed digest resists contact guessing."""
    if len(secret) < 32:
        raise LifecycleError("Idempotency HMAC secret requires at least 32 bytes")
    canonical = json.dumps(
        validated_payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode()
    return hashlib.sha256(str(key).encode()).hexdigest(), hmac.new(
        secret, canonical, hashlib.sha256
    ).hexdigest()
