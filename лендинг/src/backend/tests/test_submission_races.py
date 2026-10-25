# ruff: noqa: F811
import threading
import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.api import public
from app.db import get_db
from app.main import create_app
from app.models import Candidate, PublicSubmission
from tests.t2_support import t2_db, t2_engine  # noqa: F401
from tests.test_auth import ORIGIN, client  # noqa: F401
from tests.test_candidates import intake, submit  # noqa: F401


@pytest.mark.parametrize("different", [False, True])
def test_parallel_same_key(t2_engine, t2_db, intake, different):
    app = create_app()

    def request_db() -> Iterator[Session]:
        with Session(t2_engine) as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise

    app.dependency_overrides[get_db] = request_db
    barrier = threading.Barrier(2)
    original = public.replay
    local = threading.local()

    def synchronized_replay(db, key, digest):
        receipt = original(db, key, digest)
        if not getattr(local, "initial_checked", False):
            local.initial_checked = True
            assert receipt is None
            barrier.wait(timeout=15)
        return receipt

    key = str(uuid.uuid4())

    def send(index):
        body = {**intake, "age": 18 + index if different else 18}
        with TestClient(app, base_url=ORIGIN, headers={"Origin": ORIGIN}) as browser:
            return submit(browser, body, key)

    with (
        patch.object(public, "replay", side_effect=synchronized_replay),
        ThreadPoolExecutor(2) as pool,
    ):
        results = list(pool.map(send, [0, 1]))
    assert sorted(r.status_code for r in results) == ([201, 409] if different else [201, 201])
    assert all(r.json() == {"message": "Анкета принята"} for r in results if r.status_code == 201)
    assert t2_db.scalar(select(func.count()).select_from(Candidate)) == 1
    assert t2_db.scalar(select(func.count()).select_from(PublicSubmission)) == 1


@pytest.mark.parametrize("phase", ["audit", "commit"])
def test_intake_disconnect_rolls_back(client, t2_db, intake, phase):
    error = OperationalError(
        "synthetic SQL WITH PRIVATE CONTACT", {}, Exception("private password")
    )
    target, name = (public, "audit") if phase == "audit" else (t2_db, "commit")
    with patch.object(target, name, side_effect=error):
        response = submit(client, intake)
    assert response.status_code == 503
    assert response.json()["code"] == "SERVICE_UNAVAILABLE"
    assert response.json()["request_id"] == response.headers["x-request-id"]
    assert "PRIVATE" not in response.text and "password" not in response.text
    assert t2_db.scalar(select(func.count()).select_from(Candidate)) == 0
    assert t2_db.scalar(select(func.count()).select_from(PublicSubmission)) == 0


def test_public_db_unavailable(client, t2_db):
    with patch.object(
        t2_db, "get", side_effect=OperationalError("private", {}, Exception("secret"))
    ):
        response = client.get("/api/v1/public/privacy")
    assert response.status_code == 503 and "secret" not in response.text
