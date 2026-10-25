# ruff: noqa: F811
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditEvent
from app.services.lifecycle import audit
from tests.t2_support import t2_db, t2_engine  # noqa: F401
from tests.test_auth import client  # noqa: F401
from tests.test_employees import sign_in, user


def test_audit_filters_pagination_no_pii(client: TestClient, t2_db: Session) -> None:
    actor = user(t2_db, 'admin@example.test', role='admin')
    other = user(t2_db, 'staff@example.test')
    audit(t2_db, 'approve', other.id, ['state'], actor.id)
    audit(t2_db, 'reject', other.id, ['state'], other.id)
    t2_db.flush()
    event = t2_db.scalar(select(AuditEvent).where(AuditEvent.action == 'approve'))
    event.created_at = datetime.now(UTC) - timedelta(days=3)
    t2_db.commit()
    sign_in(client, actor)
    root = '/api/v1/admin/audit'
    response = client.get(root, params={'action': 'approve', 'actor_id': str(actor.id)}).json()
    assert response['total'] == 1
    assert set(response['items'][0]) == {'id', 'actor_id', 'entity_id', 'action',
                                       'changed_fields', 'created_at'}
    assert 'example.test' not in str(response)
    today = datetime.now(UTC).date()
    assert client.get(root, params={'date_from': str(today), 'action': 'approve'}).json()['total'] == 0
    assert client.get(root, params={'date_to': str(today - timedelta(days=1))}).json()['total'] == 1
    assert client.get(root + '?page=2&page_size=20').json()['items'] == []
    for query in ('actor_id=invalid', 'page=0', 'page_size=21', 'action=unknown',
                  'date_from=bad', 'date_from=2026-10-02&date_to=2026-10-01'):
        assert client.get(root + '?' + query).status_code == 422
