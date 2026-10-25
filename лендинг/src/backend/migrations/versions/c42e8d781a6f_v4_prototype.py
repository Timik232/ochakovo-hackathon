"""V4 vacancies, candidate enrichment, archive and stage vocabulary.

No production data conversion: re-seed disposable demos before changing stages.
The existing provenance trigger and search/phone indexes are intentionally untouched.
"""

import sqlalchemy as sa
from alembic import op

revision = "c42e8d781a6f"
down_revision = "85d0ea9c70bc"
branch_labels = None
depends_on = None

# Frozen migration contract: do not import runtime ORM metadata.
OLD_AUDIT_FIELDS = (
    "first_name", "last_name", "middle_name", "phone", "email", "position", "city",
    "experience", "available_from", "status", "source", "department", "responsible_id",
    "priority", "expected_salary", "interview_at", "next_contact_at", "role", "state",
    "password_hash", "must_change_password", "collection_enabled", "revision", "retention_days",
    "notice", "consent", "operator_identity", "processing_basis", "processing_basis_note",
)
NEW_AUDIT_FIELDS = (
    "hot", "rating", "next_step", "archived_at", "vacancy_id", "telegram", "age", "who",
    "edu_level", "school", "specialty", "grad_year", "employment", "shifts", "resume_url",
    "about", "event",
)
STRING_COLUMNS = {
    "telegram": 64, "who": 20, "edu_level": 20, "school": 200, "specialty": 200,
    "employment": 20, "shifts": 200, "resume_url": 500, "about": 2000, "event": 100,
    "next_step": 500,
}
CHECKS = {
    "age": "age BETWEEN 14 AND 80",
    "who": "who IN ('school','student','graduate','working','other')",
    "edu_level": "edu_level IN ('school','college','bachelor','master','other')",
    "grad_year": "grad_year BETWEEN 1950 AND 2100",
    "employment": "employment IN ('full','part','practice','internship')",
    "rating": "rating BETWEEN 0 AND 5",
    "telegram_normalized": "telegram = '@' || lower(ltrim(btrim(telegram), '@')) AND telegram ~ '^@[^@[:space:]]+$'",
}


def _audit_check(fields: tuple[str, ...]) -> None:
    op.create_check_constraint(
        op.f("ck_audit_events_field_names"), "audit_events",
        "changed_fields <@ ARRAY[" + ",".join("'" + name + "'" for name in fields) + "]::text[]",
    )


def _status_check(review: str, reject: str) -> None:
    op.create_check_constraint(
        op.f("ck_candidates_status"), "candidates",
        f"status IN ('application','new','{review}','interview','offer','hired','{reject}','withdrawn')",
    )


def upgrade() -> None:
    op.create_table(
        "vacancies",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("slug", sa.String(40), nullable=False),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("dept", sa.String(150), nullable=False),
        sa.Column("pay", sa.String(100), nullable=False),
        sa.Column("schedule", sa.String(200), nullable=False),
        sa.Column("icon", sa.String(40), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("sort", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_vacancies")),
        sa.UniqueConstraint("slug", name=op.f("uq_vacancies_slug")),
    )
    op.create_index("ix_vacancies_is_active_sort", "vacancies", ["is_active", "sort"])
    for name, length in STRING_COLUMNS.items():
        op.add_column("candidates", sa.Column(name, sa.String(length), nullable=True))
    for name in ("age", "grad_year"):
        op.add_column("candidates", sa.Column(name, sa.Integer(), nullable=True))
    op.add_column("candidates", sa.Column("vacancy_id", sa.Uuid(), nullable=True))
    op.add_column("candidates", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("candidates", sa.Column("hot", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("candidates", sa.Column("rating", sa.Integer(), server_default="0", nullable=False))
    for name, expression in CHECKS.items():
        op.create_check_constraint(op.f("ck_candidates_" + name), "candidates", expression)
    op.create_foreign_key(
        op.f("fk_candidates_vacancy_id_vacancies"), "candidates", "vacancies",
        ["vacancy_id"], ["id"], ondelete="RESTRICT",
    )
    op.create_index("ix_candidates_vacancy_id", "candidates", ["vacancy_id"])
    op.create_index("ix_candidates_archived_at", "candidates", ["archived_at"], postgresql_where=sa.text("archived_at IS NULL"))
    op.drop_constraint(op.f("ck_candidates_status"), "candidates", type_="check")
    _status_check("review", "reject")
    op.drop_constraint(op.f("ck_audit_events_field_names"), "audit_events", type_="check")
    _audit_check(OLD_AUDIT_FIELDS + NEW_AUDIT_FIELDS)
    op.execute("""
        CREATE FUNCTION candidate_telegram_normalize() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          NEW.telegram := CASE WHEN length(ltrim(btrim(NEW.telegram), '@')) > 0
            THEN '@' || lower(ltrim(btrim(NEW.telegram), '@')) ELSE NULL END;
          RETURN NEW;
        END $$;
        CREATE TRIGGER candidate_telegram_normalize BEFORE INSERT OR UPDATE OF telegram ON candidates
          FOR EACH ROW EXECUTE FUNCTION candidate_telegram_normalize();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER candidate_telegram_normalize ON candidates")
    op.execute("DROP FUNCTION candidate_telegram_normalize()")
    op.drop_constraint(op.f("ck_audit_events_field_names"), "audit_events", type_="check")
    _audit_check(OLD_AUDIT_FIELDS)
    op.drop_constraint(op.f("ck_candidates_status"), "candidates", type_="check")
    _status_check("contacted", "rejected")
    op.drop_index("ix_candidates_archived_at", table_name="candidates")
    op.drop_index("ix_candidates_vacancy_id", table_name="candidates")
    op.drop_constraint(op.f("fk_candidates_vacancy_id_vacancies"), "candidates", type_="foreignkey")
    for name in CHECKS:
        op.drop_constraint(op.f("ck_candidates_" + name), "candidates", type_="check")
    for name in (*STRING_COLUMNS, "age", "grad_year", "vacancy_id", "archived_at", "hot", "rating"):
        op.drop_column("candidates", name)
    op.drop_index("ix_vacancies_is_active_sort", table_name="vacancies")
    op.drop_table("vacancies")
