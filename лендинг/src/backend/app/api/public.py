"""Anonymous intake: only a generic receipt, including retries and spam traps."""

import hmac
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from pydantic import UUID4, BaseModel
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import Message
from app.api.vacancies import VacancyView
from app.config import get_settings
from app.db import get_db
from app.models import Candidate, PrivacyConfig, PublicSubmission, Vacancy
from app.schemas.candidates import PublicApplication
from app.security.errors import APIError
from app.security.origin import require_json_origin
from app.services.candidates import (
    policy_for_intake,
    storage_values,
    validate_references,
    validate_start,
)
from app.services.lifecycle import audit, submission_fingerprints

router = APIRouter(prefix="/api/v1/public", tags=["public"])
RECEIPT = "Анкета принята"


class PublicPrivacy(BaseModel):
    notice: str | None
    consent: str | None
    revision: int
    collection_enabled: bool


@router.get("/privacy", operation_id="public_privacy")
def privacy(db: Session = Depends(get_db)) -> PublicPrivacy:
    policy = db.get(PrivacyConfig, 1)
    if policy is None or policy.activated_at is None:
        return PublicPrivacy(notice=None, consent=None, revision=0, collection_enabled=False)
    return PublicPrivacy(
        notice=policy.notice,
        consent=policy.consent,
        revision=policy.revision,
        collection_enabled=policy.collection_enabled,
    )


@router.get("/vacancies", operation_id="public_vacancies")
def vacancies(db: Session = Depends(get_db)) -> list[VacancyView]:
    return [
        VacancyView.model_validate(row)
        for row in db.scalars(
            select(Vacancy).where(Vacancy.is_active.is_(True)).order_by(Vacancy.sort, Vacancy.id)
        )
    ]


def replay(db: Session, key_hash: str, payload_hmac: str) -> Message | None:
    row = db.scalar(
        select(PublicSubmission).where(
            PublicSubmission.key_hash == key_hash, PublicSubmission.expires_at > datetime.now(UTC)
        )
    )
    if row is None:
        return None
    if not hmac.compare_digest(row.payload_hmac, payload_hmac):
        raise APIError(409, "IDEMPOTENCY_CONFLICT", "Повтори отправку с новым ключом")
    return Message(message=RECEIPT)


@router.post(
    "/applications",
    status_code=201,
    operation_id="public_application_submit",
    dependencies=[Depends(require_json_origin)],
)
def applications(
    data: PublicApplication,
    idempotency_key: Annotated[UUID4, Header(alias="Idempotency-Key")],
    db: Session = Depends(get_db),
) -> Message:
    if data.website:
        return Message(message=RECEIPT)
    secret = get_settings().submission_hmac_secret
    if secret is None or len(secret.encode()) < 32:
        raise APIError(503, "SERVICE_UNAVAILABLE", "Приём анкет временно недоступен")
    key_hash, payload_hmac = submission_fingerprints(
        idempotency_key, data.model_dump(mode="json"), secret.encode()
    )
    receipt = replay(db, key_hash, payload_hmac)
    if receipt:
        return receipt
    policy = policy_for_intake(db)
    if data.privacy_revision != policy.revision:
        raise APIError(409, "PRIVACY_REVISION_CHANGED", "Условия обновились. Прочитай их ещё раз")
    if data.age < 18:
        raise APIError(422, "VALIDATION_ERROR", "На стажировку и работу берём с 18 лет")
    validate_start(data)
    values = data.model_dump(exclude={"consent", "privacy_revision", "website"})
    validate_references(db, values, public=True)
    values = storage_values(values)
    candidate = Candidate(
        **values,
        status="application",
        source="public_form",
        processing_basis="candidate_consent",
        created_by=None,
    )
    try:
        # Expired reservations are reusable; deletion and both inserts share one transaction.
        db.execute(
            delete(PublicSubmission).where(
                PublicSubmission.key_hash == key_hash,
                PublicSubmission.expires_at <= datetime.now(UTC),
            )
        )
        db.add(candidate)
        db.flush()
        db.add(
            PublicSubmission(
                key_hash=key_hash,
                payload_hmac=payload_hmac,
                candidate_id=candidate.id,
                receipt=RECEIPT,
                expires_at=datetime.now(UTC) + timedelta(hours=24),
            )
        )
        audit(db, "create", candidate.id)
        db.commit()
    except IntegrityError as exc:
        db.rollback()  # failed transaction MUST end before reading the winner
        if getattr(exc.orig, "sqlstate", None) != "23505":
            raise
        receipt = replay(db, key_hash, payload_hmac)  # new READ COMMITTED transaction
        if receipt is None:
            raise APIError(503, "SERVICE_UNAVAILABLE", "Повтори отправку позже") from None
        return receipt
    return Message(message=RECEIPT)
