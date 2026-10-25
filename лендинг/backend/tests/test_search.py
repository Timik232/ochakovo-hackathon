# ruff: noqa: F811
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from app.models import Candidate
from tests.t2_support import t2_db, t2_engine  # noqa: F401
from tests.test_auth import client  # noqa: F401
from tests.test_candidates import intake, manual, staff  # noqa: F401


@pytest.fixture
def registry(client, t2_db, intake):
    staff(client, t2_db)
    # Real PostgreSQL query fixture; every page/filter is evaluated against all 45 rows.
    actor = t2_db.scalar(text("SELECT id FROM employees LIMIT 1"))
    rows = []
    for i in range(45):
        values = manual(intake)
        values.update(
            last_name=f"Семёнов {i:02}",
            first_name="Тест",
            phone=f"+7495123{i:04}",
            position="Тест%_инженер" if i == 0 else "Инженер",
            city="Орёл",
            status="review" if i % 2 else "new",
            hot=i % 3 == 0,
            priority="high" if i % 4 == 0 else "normal",
            responsible_id=actor if i % 5 == 0 else None,
            archived_at=datetime.now(UTC) if i >= 40 else None,
            created_by=actor,
            next_contact_at=datetime.now(UTC) if i == 0 else None,
        )
        row = Candidate(**values)
        t2_db.add(row)
        rows.append(row)
    t2_db.commit()
    return rows


def listing(client, **params):
    response = client.get("/api/v1/candidates", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_pagination_and_archive(client, registry):
    first = listing(client)
    second = listing(client, page=2)
    assert first["total"] == 40 and len(first["items"]) == len(second["items"]) == 20
    assert {c["id"] for c in first["items"]}.isdisjoint({c["id"] for c in second["items"]})
    assert listing(client, page=3)["items"] == []
    assert listing(client, archived="1")["total"] == 5
    assert listing(client, archived="all", page_size=50)["total"] == 45
    assert len(listing(client, archived="all", page_size=100)["items"]) == 45


@pytest.mark.parametrize(
    "params,total",
    [
        ({"q": "семен"}, 40),
        ({"q": "СЕМЁН"}, 40),
        ({"q": "495123000"}, 10),
        ({"q": "%_"}, 1),
        ({"q": "%"}, 1),
        ({"q": "_"}, 1),
        ({"q": "NOT FOUND"}, 0),
        ({"city": "ОРЕЛ"}, 40),
        ({"city": "Орё"}, 0),
        ({"position": "%_"}, 1),
        ({"status[]": ["new", "review"]}, 40),
        ({"status[]": ["review"]}, 20),
        ({"source[]": ["phone", "referral"]}, 40),
        ({"source[]": ["walk_in"]}, 0),
        ({"priority[]": ["high"]}, 10),
        ({"hot": True}, 14),
        ({"responsible_id[]": ["unassigned"]}, 32),
        ({"vacancy_id[]": [str(uuid.uuid4())]}, 0),
        ({"hot": True, "status[]": ["new"], "priority[]": ["high"]}, 4),
    ],
)
def test_all_filters(client, registry, params, total):
    assert listing(client, **params)["total"] == total


def test_assignment_vacancy_and_dates(client, registry, intake):
    actor = str(registry[0].created_by)
    assert listing(client, **{"responsible_id[]": [actor]})["total"] == 8
    assert listing(client, **{"responsible_id[]": [actor, "unassigned"]})["total"] == 40
    assert listing(client, **{"vacancy_id[]": [intake["vacancy_id"]]})["total"] == 40
    from app.services.candidates import MOSCOW

    today = datetime.now(MOSCOW).date()
    assert listing(client, created_from=str(today), created_to=str(today))["total"] == 40
    assert listing(client, created_to=str(today - timedelta(days=1)))["total"] == 0
    assert listing(client, created_from=str(today + timedelta(days=1)))["total"] == 0


@pytest.mark.parametrize(
    "sort", ["created_at", "updated_at", "last_name", "status", "next_contact_at"]
)
@pytest.mark.parametrize("direction", ["asc", "desc"])
def test_whitelist_sorts(client, registry, sort, direction):
    items = listing(client, sort=sort, direction=direction, page_size=50)["items"]
    assert len(items) == 40
    if sort == "next_contact_at":
        assert items[0]["next_contact_at"] is not None
        assert all(item["next_contact_at"] is None for item in items[1:])
    if sort == "status":
        assert items[0]["status"] == ("new" if direction == "asc" else "review")
    if sort == "last_name":
        assert items[0]["last_name"] == ("Семёнов 00" if direction == "asc" else "Семёнов 39")


@pytest.mark.parametrize(
    "params",
    [
        {"sort": "phone;DROP"},
        {"direction": "up"},
        {"page": 0},
        {"page_size": 10},
        {"q": "x" * 101},
        {"archived": "false"},
        {"hot": "bad"},
        {"status[]": "contacted"},
        {"source[]": "event"},
        {"priority[]": "urgent"},
        {"responsible_id[]": "bad"},
        {"vacancy_id[]": "bad"},
        {"created_from": "bad"},
        {"created_from": "2026-02-01", "created_to": "2026-01-01"},
    ],
)
def test_invalid_filters(client, registry, params):
    assert client.get("/api/v1/candidates", params=params).status_code == 422
