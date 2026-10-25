# ruff: noqa: F811
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.db import get_db
from app.main import create_app
from app.models import AuditEvent, Employee, PrivacyConfig
from app.models import Session as LoginSession
from app.security.passwords import hash_password, verify_password
from tests.t2_support import employee, policy, t2_db, t2_engine  # noqa: F401
from tests.test_auth import ORIGIN, PASSWORD, client  # noqa: F401


def sign_in(client: TestClient, user: Employee) -> dict[str, str]:
    assert client.post('/api/v1/auth/login', json={
        'email': user.email, 'password': PASSWORD,
    }).status_code == 200
    return {'X-CSRF-Token': client.get('/api/v1/auth/me').json()['csrf_token']}


def user(db: Session, email: str, state: str = 'active', role: str = 'staff') -> Employee:
    result = employee(db, email, role)
    result.state = state
    result.password_hash = hash_password(PASSWORD)
    db.commit()
    return result


ADMIN_ROUTES = [
    ('GET', '/employees', 'active'),
    ('GET', '/audit', 'active'),
    ('POST', '/employees/{id}/approve', 'pending'),
    ('POST', '/employees/{id}/reject', 'pending'),
    ('POST', '/employees/{id}/disable', 'active'),
    ('POST', '/employees/{id}/reactivate', 'disabled'),
    ('POST', '/employees/{id}/reset-password', 'active'),
    ('POST', '/intake/disable', 'active'),
]


@pytest.mark.parametrize('role,expected', [('anonymous', 401), ('staff', 403), ('admin', 200)])
@pytest.mark.parametrize('method,path,state', ADMIN_ROUTES)
def test_every_admin_route_rbac(client: TestClient, t2_db: Session, role: str,
                                expected: int, method: str, path: str, state: str) -> None:
    target = user(t2_db, 'target@example.test', state)
    headers = {}
    if role != 'anonymous':
        headers = sign_in(client, user(t2_db, 'actor@example.test', role=role))
    payload = {'new_password': 'временный тест 123'} if path.endswith('reset-password') else None
    result = client.request(method, '/api/v1/admin' + path.format(id=target.id),
                            headers=headers, json=payload)
    assert result.status_code == expected
    assert PASSWORD not in result.text and 'временный тест 123' not in result.text


def test_approve_reject_reapprove_and_no_target_session(client: TestClient, t2_db: Session) -> None:
    admin = user(t2_db, 'admin@example.test', role='admin')
    target = user(t2_db, 'target@example.test', 'pending')
    headers = sign_in(client, admin)
    root = f'/api/v1/admin/employees/{target.id}'
    assert client.post(root + '/reject', headers=headers).status_code == 200
    t2_db.refresh(target)
    assert target.state == 'rejected' and t2_db.get(Employee, target.id)
    response = client.post(root + '/approve', headers=headers)
    assert response.status_code == 200 and 'set-cookie' not in response.headers
    t2_db.refresh(target)
    assert target.state == 'active' and target.approved_by == admin.id and target.approved_at
    assert t2_db.scalar(select(func.count()).select_from(LoginSession)
                        .where(LoginSession.employee_id == target.id)) == 0
    client.cookies.clear()
    sign_in(client, target)
    assert client.get('/api/v1/employees/options').status_code == 200


def test_reset_password_forces_change_revokes_all_and_never_leaks(client: TestClient,
                                                                t2_db: Session) -> None:
    admin = user(t2_db, 'admin@example.test', role='admin')
    target = user(t2_db, 'target@example.test', 'pending')
    approval_headers = sign_in(client, admin)
    assert client.post(f'/api/v1/admin/employees/{target.id}/approve',
                       headers=approval_headers).status_code == 200
    client.cookies.clear()
    sign_in(client, target)
    old = client.cookies.get('ochakovo_session')
    client.cookies.clear()
    sign_in(client, target)
    client.cookies.clear()
    headers = sign_in(client, admin)
    temporary = 'временный тест 123'
    response = client.post(f'/api/v1/admin/employees/{target.id}/reset-password',
                           headers=headers, json={'new_password': temporary})
    assert response.status_code == 200 and temporary not in response.text
    t2_db.refresh(target)
    assert target.must_change_password and verify_password(temporary, target.password_hash)
    assert target.password_hash != temporary
    assert t2_db.scalar(select(func.count()).select_from(LoginSession)
                        .where(LoginSession.employee_id == target.id)) == 0
    assert client.get('/api/v1/auth/me', headers={
        'Cookie': f'ochakovo_session={old}'}).status_code == 401
    client.cookies.clear()
    assert client.post('/api/v1/auth/login', json={
        'email': target.email, 'password': temporary}).status_code == 200
    me = client.get('/api/v1/auth/me').json()
    assert me['must_change_password']
    assert client.get('/api/v1/employees/options').status_code == 403
    assert client.post('/api/v1/auth/password', headers={'X-CSRF-Token': me['csrf_token']},
                       json={'current_password': temporary,
                             'new_password': PASSWORD}).status_code == 204
    sign_in(client, target)
    assert client.get('/api/v1/employees/options').status_code == 200
    events = t2_db.scalars(select(AuditEvent).where(AuditEvent.action == 'reset_password')).all()
    assert len(events) == 1 and events[0].actor_id == admin.id
    assert events[0].changed_fields == ['password_hash', 'must_change_password']
    assert temporary not in str([e.__dict__ for e in events])


def test_disable_revokes_then_reactivate(client: TestClient, t2_db: Session) -> None:
    admin = user(t2_db, 'admin@example.test', role='admin')
    target = user(t2_db, 'target@example.test')
    sign_in(client, target)
    old = client.cookies.get('ochakovo_session')
    client.cookies.clear()
    headers = sign_in(client, admin)
    root = f'/api/v1/admin/employees/{target.id}'
    assert client.post(root + '/disable', headers=headers).status_code == 200
    assert client.get('/api/v1/auth/me', headers={
        'Cookie': f'ochakovo_session={old}'}).status_code == 401
    assert client.post(root + '/reactivate', headers=headers).status_code == 200
    t2_db.refresh(target)
    assert target.state == 'active' and target.approved_by == admin.id


@pytest.mark.parametrize('action,state', [('approve', 'active'), ('reject', 'active'),
                                        ('disable', 'pending'), ('reactivate', 'rejected')])
def test_invalid_transitions(client: TestClient, t2_db: Session, action: str, state: str) -> None:
    target = user(t2_db, 'target@example.test', state)
    headers = sign_in(client, user(t2_db, 'admin@example.test', role='admin'))
    assert client.post(f'/api/v1/admin/employees/{target.id}/{action}',
                       headers=headers).status_code == 409
    t2_db.refresh(target)
    assert target.state == state


def test_last_admin_and_validation(client: TestClient, t2_db: Session) -> None:
    admin = user(t2_db, 'admin@example.test', role='admin')
    headers = sign_in(client, admin)
    root = f'/api/v1/admin/employees/{admin.id}'
    assert client.post(root + '/disable', headers=headers).status_code == 409
    assert client.post(f'/api/v1/admin/employees/{uuid.uuid4()}/approve',
                       headers=headers).status_code == 404
    for payload in ({'new_password': 'short'}, {'new_password': PASSWORD, 'role': 'admin'}):
        assert client.post(root + '/reset-password', headers=headers,
                           json=payload).status_code == 422
    assert client.delete(root, headers=headers).status_code == 404
    assert client.post(root + '/promote', headers=headers).status_code == 404


@pytest.mark.parametrize('method,path,state', [item for item in ADMIN_ROUTES if item[0] == 'POST'])
@pytest.mark.parametrize('fault', ['missing_csrf', 'wrong_csrf', 'foreign_origin', 'forced_change'])
def test_admin_mutations_keep_security_guards(client: TestClient, t2_db: Session,
                                             method: str, path: str, state: str,
                                             fault: str) -> None:
    target = user(t2_db, 'target@example.test', state)
    actor = user(t2_db, 'admin@example.test', role='admin')
    headers = sign_in(client, actor)
    if fault == 'missing_csrf':
        headers = {}
    elif fault == 'wrong_csrf':
        headers['X-CSRF-Token'] = 'wrong'
    elif fault == 'foreign_origin':
        headers['Origin'] = 'https://foreign.test'
    else:
        actor.must_change_password = True
        t2_db.commit()
    payload = {'new_password': 'временный тест 123'} if path.endswith('reset-password') else None
    result = client.request(method, '/api/v1/admin' + path.format(id=target.id),
                            headers=headers, json=payload)
    assert result.status_code == 403
    t2_db.refresh(target)
    assert target.state == state and not target.must_change_password


@pytest.mark.parametrize('action', ['approve', 'reject', 'disable', 'reactivate', 'reset-password'])
def test_nonexistent_target(client: TestClient, t2_db: Session, action: str) -> None:
    headers = sign_in(client, user(t2_db, 'admin@example.test', role='admin'))
    payload = {'new_password': 'временный тест 123'} if action == 'reset-password' else None
    result = client.post(f'/api/v1/admin/employees/{uuid.uuid4()}/{action}',
                         headers=headers, json=payload)
    assert result.status_code == 404


def test_employee_search_pagination_and_options(client: TestClient, t2_db: Session) -> None:
    admin = user(t2_db, 'admin@example.test', role='admin')
    target = user(t2_db, 'literal_%@example.test')
    target.first_name, target.last_name = 'Пётр', 'Тестов'
    user(t2_db, 'pending@example.test', 'pending')
    t2_db.commit()
    sign_in(client, admin)
    for q in ('ПЕТР', 'Тестов Петр', 'literal_%'):
        data = client.get('/api/v1/admin/employees', params={'q': q}).json()
        assert data['total'] == 1 and data['items'][0]['id'] == str(target.id)
    assert client.get('/api/v1/admin/employees?state=pending').json()['total'] == 1
    data = client.get('/api/v1/admin/employees?page=2&page_size=20').json()
    assert data['items'] == [] and data['total'] == 3 and data['page'] == 2
    for query in ('state=bogus', 'page=0', 'page_size=21', 'q=' + 'x' * 101):
        assert client.get('/api/v1/admin/employees?' + query).status_code == 422
    options = client.get('/api/v1/employees/options').json()
    assert len(options) == 2
    assert all(set(item) == {'id', 'name'} for item in options)
    client.cookies.clear()
    assert client.get('/api/v1/employees/options').status_code == 401


@pytest.mark.parametrize('activated', [False, True])
def test_intake_kill_switch_only_disables(client: TestClient, t2_db: Session,
                                        activated: bool) -> None:
    if activated:
        policy(t2_db)
    headers = sign_in(client, user(t2_db, 'admin@example.test', role='admin'))
    for _ in range(2):
        assert client.post('/api/v1/admin/intake/disable', headers=headers).status_code == 200
    config = t2_db.get(PrivacyConfig, 1)
    t2_db.refresh(config)
    assert not config.collection_enabled
    assert (config.activated_at is not None) == activated
    assert client.post('/api/v1/admin/intake/enable', headers=headers).status_code == 404
    assert client.post('/api/v1/admin/intake/disable', headers=headers,
                       json={'collection_enabled': True}).status_code == 422


def test_concurrent_disable_last_admins(t2_engine: Engine, t2_db: Session) -> None:
    from app.api import admin as admin_api
    from app.config import get_settings
    from app.services.lifecycle import admin_lock

    admins = [user(t2_db, f'admin{i}@example.test', role='admin') for i in range(2)]
    ids = [item.id for item in admins]
    barrier = Barrier(2)
    pids: list[int] = []
    app = create_app()

    def request_db():
        with Session(t2_engine) as db:
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise

    app.dependency_overrides[get_db] = request_db

    def synchronized_lock(db: Session) -> None:
        pids.append(db.scalar(text('SELECT pg_backend_pid()')))
        db.execute(text("SET LOCAL lock_timeout = '5s'"))
        barrier.wait(timeout=10)
        admin_lock(db)

    def disable(index: int) -> int:
        with TestClient(app, base_url=ORIGIN, headers={'Origin': ORIGIN}) as client:
            headers = sign_in(client, admins[index])
            # Auth preflight has finished in both connections before taking the advisory lock.
            return client.post(f'/api/v1/admin/employees/{ids[1-index]}/disable',
                               headers=headers).status_code

    with patch.object(get_settings(), 'app_origin', ORIGIN), \
         patch.object(admin_api, 'admin_lock', synchronized_lock), \
         ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(disable, range(2)))
    assert sorted(results) == [200, 409]
    assert len(set(pids)) == 2
    t2_db.expire_all()
    assert t2_db.scalar(select(func.count()).select_from(Employee).where(
        Employee.role == 'admin', Employee.state == 'active')) == 1
    assert t2_db.scalar(select(func.count()).select_from(AuditEvent).where(
        AuditEvent.action == 'disable')) == 1
