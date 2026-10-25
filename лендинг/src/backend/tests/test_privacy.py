"""Policy activation, retention and isolated-connection lock tests."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import cast

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import AuditEvent, Candidate, CandidateComment, PrivacyConfig, PublicSubmission
from app.models import Session as EmployeeSession
from app.services.lifecycle import (
    CLEANUP_LOCK,
    SYSTEM_ACTOR,
    LifecycleError,
    activate_privacy,
    cleanup,
    ensure_not_last_admin,
    submission_fingerprints,
)
from tests.t2_support import candidate, employee, policy
from tests.t2_support import t2_db as t2_db
from tests.t2_support import t2_engine as t2_engine


@pytest.mark.parametrize(
    "override",
    [
        {"operator_identity": " "},
        {"notice": ""},
        {"consent": ""},
        {"revision": 0},
        {"retention_days": 0},
        {"retention_days": 366},
        {"authorized": False},
        {"origin": "http://example.test"},
        {"origin": "https://example.test/path"},
    ],
)
def test_privacy_activation_missing_legal_fields(
    t2_db: Session, override: dict[str, object]
) -> None:
    values: dict[str, object] = {
        "operator_identity": "Synthetic operator",
        "notice": "Test notice",
        "consent": "Test consent",
        "revision": 1,
        "retention_days": 30,
        "authorized": True,
        "origin": "https://example.test",
    }
    values.update(override)
    with pytest.raises(LifecycleError):
        activate_privacy(
            t2_db,
            operator_identity=cast(str, values["operator_identity"]),
            notice=cast(str, values["notice"]),
            consent=cast(str, values["consent"]),
            revision=cast(int, values["revision"]),
            retention_days=cast(int, values["retention_days"]),
            authorized=cast(bool, values["authorized"]),
            origin=cast(str, values["origin"]),
        )
    config = t2_db.get(PrivacyConfig, 1)
    assert config is not None and not config.collection_enabled and config.revision == 0
    assert t2_db.scalar(select(func.count()).select_from(AuditEvent)) == 0


def test_disabled_default_and_revision_guard(t2_db: Session) -> None:
    with pytest.raises(IntegrityError), t2_db.begin_nested():
        candidate(t2_db)
    config = policy(t2_db)
    with pytest.raises(LifecycleError):
        activate_privacy(
            t2_db,
            operator_identity="Synthetic test operator",
            notice="Changed",
            consent="Synthetic consent",
            revision=1,
            retention_days=30,
            authorized=True,
            origin="https://example.test",
        )
    with pytest.raises(IntegrityError), t2_db.begin_nested():
        t2_db.execute(text("UPDATE privacy_config SET notice='Changed' WHERE id=1"))
    record = candidate(t2_db)
    config.collection_enabled = False
    t2_db.flush()
    record.status = "interview"
    t2_db.flush()
    with pytest.raises(IntegrityError), t2_db.begin_nested():
        candidate(t2_db)


def test_cleanup_only_expired_idempotent_and_audit(t2_db: Session) -> None:
    policy(t2_db)
    actor = employee(t2_db)
    expired = candidate(t2_db)
    expired_id = expired.id
    active = candidate(t2_db)
    # Frozen future cleanup instant avoids bypassing the immutable provenance trigger.
    cutoff = expired.retention_due_at
    t2_db.add(
        CandidateComment(
            candidate_id=expired.id, created_by=actor.id, body="Synthetic private comment"
        )
    )
    t2_db.add(PublicSubmission(key_hash="a" * 64, payload_hmac="b" * 64, candidate_id=expired.id))
    t2_db.add(
        PublicSubmission(
            key_hash="c" * 64,
            payload_hmac="d" * 64,
            candidate_id=active.id,
            expires_at=cutoff + timedelta(days=1),
        )
    )
    old = datetime.now(UTC) - timedelta(days=181)
    t2_db.add(
        AuditEvent(actor_id=SYSTEM_ACTOR, action="create", entity_id=uuid.uuid4(), created_at=old)
    )
    t2_db.add(
        EmployeeSession(
            employee_id=actor.id,
            token_hash="e" * 64,
            csrf_token="test-csrf",
            expires_at=cutoff + timedelta(hours=1),
            idle_expires_at=cutoff - timedelta(seconds=1),
        )
    )
    t2_db.add(
        EmployeeSession(
            employee_id=actor.id,
            token_hash="f" * 64,
            csrf_token="test-csrf",
            expires_at=cutoff + timedelta(hours=1),
            idle_expires_at=cutoff + timedelta(minutes=30),
        )
    )
    t2_db.flush()
    counts = cleanup(t2_db, now=cutoff)
    assert counts == {"candidates": 1, "submissions": 0, "sessions": 1, "audit": 1}
    assert t2_db.scalar(select(Candidate.id)) == active.id
    assert t2_db.scalar(select(CandidateComment.id)) is None
    assert t2_db.scalar(select(PublicSubmission.candidate_id)) == active.id
    deletion = t2_db.scalar(select(AuditEvent).where(AuditEvent.action == "retention_delete"))
    assert (
        deletion is not None
        and deletion.actor_id == SYSTEM_ACTOR
        and deletion.entity_id == expired_id
    )
    assert deletion.changed_fields == []
    assert cleanup(t2_db, now=cutoff) == {
        "candidates": 0,
        "submissions": 0,
        "sessions": 0,
        "audit": 0,
    }


def test_submission_expiry_24h(t2_db: Session) -> None:
    policy(t2_db)
    record = candidate(t2_db)
    submission = PublicSubmission(key_hash="a" * 64, payload_hmac="b" * 64, candidate_id=record.id)
    t2_db.add(submission)
    t2_db.flush()
    assert submission.expires_at - submission.created_at == timedelta(hours=24)
    counts = cleanup(t2_db, now=submission.expires_at)
    assert counts["submissions"] == 1 and counts["candidates"] == 0


def test_cleanup_parallel_lock(t2_engine: Engine) -> None:
    with Session(t2_engine) as first, Session(t2_engine) as second:
        first.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": CLEANUP_LOCK})
        with pytest.raises(LifecycleError, match="already running"):
            cleanup(second)
        second.rollback()
        first.rollback()
        assert cleanup(second)["candidates"] == 0


def test_last_admin_guard(t2_db: Session) -> None:
    actor = employee(t2_db)
    with pytest.raises(LifecycleError, match="last active admin"):
        ensure_not_last_admin(t2_db, actor)
    employee(t2_db, "backup@example.test")
    ensure_not_last_admin(t2_db, actor)


def test_hmac_canonical_payload() -> None:
    key = uuid.uuid4()
    one = submission_fingerprints(key, {"a": "Synthetic", "b": 2}, b"x" * 32)
    two = submission_fingerprints(key, {"b": 2, "a": "Synthetic"}, b"x" * 32)
    assert one == two
    assert one[1] != submission_fingerprints(key, {"a": "Changed"}, b"x" * 32)[1]
    assert one[1] != submission_fingerprints(key, {"a": "Synthetic", "b": 2}, b"y" * 32)[1]
