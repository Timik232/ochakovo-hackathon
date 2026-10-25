"""Staff registry, append-only comments, atomic advisory bulk and bounded CSV export."""

import csv
import io
import re
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AUDIT_FIELDS, Candidate, CandidateComment, Employee, Vacancy
from app.schemas.candidates import (
    BulkInput,
    CandidateCreate,
    CandidatePage,
    CandidatePatch,
    CandidateView,
    CommentInput,
    CommentPage,
    CommentView,
)
from app.security.deps import current_employee, require_admin
from app.security.errors import APIError
from app.services.candidates import (
    MOSCOW,
    CandidateFilters,
    detail,
    get_candidate,
    mutation_allowed,
    policy_for_intake,
    query_candidates,
    sorted_query,
    storage_values,
    validate_references,
    validate_start,
    versioned_update,
)
from app.services.lifecycle import audit

router = APIRouter(prefix="/api/v1/candidates", tags=["candidates"])
Filters = Annotated[CandidateFilters, Query()]


@router.get("", operation_id="candidates_list")
def list_candidates(
    filters: Filters, actor: Employee = Depends(current_employee), db: Session = Depends(get_db)
) -> CandidatePage:
    query = query_candidates(filters)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        sorted_query(query, filters)
        .offset((filters.page - 1) * filters.page_size)
        .limit(filters.page_size)
    )
    # Duplicate warning is intentionally detail/save-only, not an N+1 list query.
    return CandidatePage(
        items=[CandidateView.model_validate(row) for row in rows],
        total=total,
        page=filters.page,
        page_size=filters.page_size,
    )


@router.post("", status_code=201, operation_id="candidate_create")
def create_candidate(
    data: CandidateCreate,
    actor: Employee = Depends(current_employee),
    db: Session = Depends(get_db),
) -> CandidateView:
    policy_for_intake(db)
    validate_start(data)
    values = data.model_dump()
    validate_references(db, values)
    row = Candidate(**storage_values(values), created_by=actor.id, updated_by=actor.id)
    db.add(row)
    db.flush()
    db.refresh(row)
    audit(db, "create", row.id, [name for name in values if name in AUDIT_FIELDS], actor.id)
    result = detail(db, row)
    db.commit()
    return result


class BulkResult(BaseModel):
    updated: int


@router.post("/bulk", operation_id="candidates_bulk")
def bulk_candidates(
    data: BulkInput, actor: Employee = Depends(current_employee), db: Session = Depends(get_db)
) -> BulkResult:
    mutation_allowed(db)
    ids = sorted(set(data.ids))
    rows = list(
        db.scalars(
            select(Candidate).where(Candidate.id.in_(ids)).order_by(Candidate.id).with_for_update()
        )
    )
    if len(rows) != len(ids):
        raise APIError(404, "NOT_FOUND", "Один из кандидатов не найден")
    # Advisory fast path: no client versions. Lock all rows in UUID order, increment each
    # current version so stale individual editors still conflict; never overwrite other fields.
    field = "status" if data.action == "stage" else "archived_at"
    value = (
        data.stage
        if data.action == "stage"
        else (datetime.now(UTC) if data.action == "archive" else None)
    )
    for row in rows:
        setattr(row, field, value)
        row.version += 1
        row.updated_by = actor.id
        audit(db, "update", row.id, [field], actor.id)
    db.commit()
    return BulkResult(updated=len(rows))


CSV_COLUMNS = [
    "ID",
    "Дата",
    "ФИО",
    "Телефон",
    "Telegram",
    "Email",
    "Возраст",
    "Кто",
    "Образование",
    "Вакансия",
    "Формат",
    "Готов начать",
    "Смена",
    "Резюме",
    "Опыт",
    "О себе",
    "Источник",
    "Кто заполнил",
    "Мероприятие",
    "Этап",
    "Оценка",
    "Горячий",
    "Следующий шаг",
]


def csv_cell(value: Any) -> str:
    text = "" if value is None else str(value)
    # Excel formula injection applies even to correctly quoted CSV cells.
    if text.lstrip().startswith(("=", "+", "-", "@", "\t", "\r", "\n")):
        return "'" + text
    return text


def csv_line(values: list[Any]) -> str:
    buffer = io.StringIO(newline="")
    csv.writer(buffer, delimiter=";", lineterminator="\r\n").writerow(
        [csv_cell(value) for value in values]
    )
    return buffer.getvalue()


@router.get(
    "/export.csv",
    operation_id="candidates_export_csv",
    response_class=StreamingResponse,
    responses={200: {"content": {"text/csv": {"schema": {"type": "string"}}}}},
)
def export_candidates(
    filters: Filters, actor: Employee = Depends(current_employee), db: Session = Depends(get_db)
) -> StreamingResponse:
    query = (
        sorted_query(query_candidates(filters), filters)
        .add_columns(Vacancy.title, Employee.last_name, Employee.first_name)
        .outerjoin(Vacancy, Candidate.vacancy_id == Vacancy.id)
        .outerjoin(Employee, Candidate.created_by == Employee.id)
    )
    result = db.execute(query.execution_options(yield_per=100))
    # Establish cursor/fetch before headers: initial DB failure gets the sanitized 503 envelope.
    first = next(result, None)

    def lines() -> Iterator[str]:
        try:
            yield "\ufeff" + csv_line(CSV_COLUMNS)
            current = first
            while current is not None:
                c, title, last, name = current
                yield csv_line(
                    [
                        c.id,
                        c.created_at.astimezone(MOSCOW).strftime("%d.%m.%Y %H:%M (МСК)"),
                        " ".join(v for v in (c.last_name, c.first_name, c.middle_name) if v),
                        c.phone,
                        c.telegram,
                        c.email,
                        c.age,
                        c.who,
                        " / ".join(
                            str(v)
                            for v in (c.edu_level, c.school, c.specialty, c.grad_year)
                            if v is not None
                        ),
                        title,
                        c.employment,
                        c.available_from,
                        c.shifts,
                        c.resume_url,
                        c.experience,
                        c.about,
                        c.source,
                        " ".join(v for v in (last, name) if v),
                        c.event,
                        c.status,
                        c.rating,
                        "Да" if c.hot else "Нет",
                        c.next_step,
                    ]
                )
                current = next(result, None)
        finally:
            result.close()

    return StreamingResponse(
        lines(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="candidates.csv"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{candidate_id}", operation_id="candidate_detail")
def candidate_detail(
    candidate_id: uuid.UUID,
    actor: Employee = Depends(current_employee),
    db: Session = Depends(get_db),
) -> CandidateView:
    return detail(db, get_candidate(db, candidate_id))


@router.patch("/{candidate_id}", operation_id="candidate_update")
def update_candidate(
    candidate_id: uuid.UUID,
    data: CandidatePatch,
    actor: Employee = Depends(current_employee),
    db: Session = Depends(get_db),
) -> CandidateView:
    mutation_allowed(db)
    values = data.model_dump(exclude_unset=True, exclude={"version"})
    for name in ("first_name", "last_name", "phone"):
        if name in values and values[name] is None:
            raise APIError(422, "VALIDATION_ERROR", "Обязательное поле не может быть пустым")
    validate_references(db, values)
    values = storage_values(values)
    row = versioned_update(db, candidate_id, data.version, {**values, "updated_by": actor.id})
    audit(db, "update", row.id, list(values), actor.id)
    response = detail(db, row)
    db.commit()
    return response


@router.delete("/{candidate_id}", status_code=204, operation_id="candidate_delete")
def delete_candidate(
    candidate_id: uuid.UUID,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
    actor: Employee = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    mutation_allowed(db)
    if (
        if_match is None
        or not re.fullmatch(r'"[1-9][0-9]{0,9}"', if_match)
        or int(if_match[1:-1]) > 2147483647
    ):
        raise APIError(422, "VALIDATION_ERROR", "Передай версию карточки в If-Match")
    get_candidate(db, candidate_id)
    identifier = db.scalar(
        delete(Candidate)
        .where(Candidate.id == candidate_id, Candidate.version == int(if_match[1:-1]))
        .returning(Candidate.id)
    )
    if identifier is None:
        raise APIError(409, "VERSION_CONFLICT", "Карточка уже изменена. Загрузи актуальную версию")
    audit(db, "delete", candidate_id, actor_id=actor.id)
    db.commit()
    return Response(status_code=204)


@router.get("/{candidate_id}/comments", operation_id="candidate_comments")
def list_comments(
    candidate_id: uuid.UUID,
    actor: Employee = Depends(current_employee),
    db: Session = Depends(get_db),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> CommentPage:
    get_candidate(db, candidate_id)
    predicate = CandidateComment.candidate_id == candidate_id
    total = db.scalar(select(func.count()).select_from(CandidateComment).where(predicate)) or 0
    rows = db.execute(
        select(CandidateComment, Employee.last_name, Employee.first_name)
        .join(Employee, CandidateComment.created_by == Employee.id)
        .where(predicate)
        .order_by(CandidateComment.created_at, CandidateComment.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = []
    for row, last, first in rows:
        item = CommentView.model_validate(row)
        item.author_name = f"{last} {first}"
        items.append(item)
    return CommentPage(items=items, total=total, page=page, page_size=page_size)


@router.post("/{candidate_id}/comments", status_code=201, operation_id="candidate_comment_add")
def add_comment(
    candidate_id: uuid.UUID,
    data: CommentInput,
    actor: Employee = Depends(current_employee),
    db: Session = Depends(get_db),
) -> CommentView:
    mutation_allowed(db)
    # Key-share candidate lock prevents concurrent deletion while appending, not other comments.
    row = db.scalar(
        select(Candidate.id)
        .where(Candidate.id == candidate_id)
        .with_for_update(read=True, key_share=True)
    )
    if row is None:
        raise APIError(404, "NOT_FOUND", "Кандидат не найден")
    comment = CandidateComment(candidate_id=candidate_id, created_by=actor.id, body=data.body)
    db.add(comment)
    db.flush()
    audit(db, "comment", candidate_id, actor_id=actor.id)
    response = CommentView.model_validate(comment)
    response.author_name = f"{actor.last_name} {actor.first_name}"
    db.commit()
    return response
