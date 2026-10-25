"""V3 optional candidate city/position: NULL instead of v4-era placeholder labels.

Placeholder rows ('Не указан'/'Не указана') are converted to NULL, NOT NULL and the
names CHECK are relaxed, and the trgm search index is rebuilt with coalesce() so a
NULL city/position never blanks the whole concatenation. Downgrade is symmetric.
"""

import sqlalchemy as sa
from alembic import op

revision = "a5f2e8d01c9b"
down_revision = "c42e8d781a6f"
branch_labels = None
depends_on = None

# Frozen migration contract: keep in sync with models.SEARCH_EXPRESSION.
OLD_SEARCH = (
    "replace(lower(last_name || ' ' || first_name || ' ' || coalesce(middle_name, '') "
    "|| ' ' || position || ' ' || city || ' ' || coalesce(email, '')), 'ё', 'е')"
)
NEW_SEARCH = (
    "replace(lower(last_name || ' ' || first_name || ' ' || coalesce(middle_name, '') "
    "|| ' ' || coalesce(position, '') || ' ' || coalesce(city, '') "
    "|| ' ' || coalesce(email, '')), 'ё', 'е')"
)
NAMES_OLD = (
    "length(btrim(first_name)) > 0 AND length(btrim(last_name)) > 0 "
    "AND length(btrim(city)) > 0 AND length(btrim(position)) > 0"
)
NAMES_NEW = "length(btrim(first_name)) > 0 AND length(btrim(last_name)) > 0"


def _search_index(expression: str) -> None:
    op.create_index(
        "ix_candidates_search",
        "candidates",
        [sa.literal_column(expression + " gin_trgm_ops")],
        unique=False,
        postgresql_using="gin",
    )


def upgrade() -> None:
    op.drop_index("ix_candidates_search", table_name="candidates", postgresql_using="gin")
    op.alter_column("candidates", "city", existing_type=sa.String(length=100), nullable=True)
    op.alter_column("candidates", "position", existing_type=sa.String(length=150), nullable=True)
    op.drop_constraint(op.f("ck_candidates_names"), "candidates", type_="check")
    op.create_check_constraint(op.f("ck_candidates_names"), "candidates", NAMES_NEW)
    op.execute("UPDATE candidates SET city = NULL WHERE city = 'Не указан'")
    op.execute("UPDATE candidates SET position = NULL WHERE position = 'Не указана'")
    _search_index(NEW_SEARCH)


def downgrade() -> None:
    op.drop_index("ix_candidates_search", table_name="candidates", postgresql_using="gin")
    op.execute("UPDATE candidates SET city = 'Не указан' WHERE city IS NULL")
    op.execute("UPDATE candidates SET position = 'Не указана' WHERE position IS NULL")
    op.alter_column("candidates", "city", existing_type=sa.String(length=100), nullable=False)
    op.alter_column("candidates", "position", existing_type=sa.String(length=150), nullable=False)
    op.drop_constraint(op.f("ck_candidates_names"), "candidates", type_="check")
    op.create_check_constraint(op.f("ck_candidates_names"), "candidates", NAMES_OLD)
    _search_index(OLD_SEARCH)
