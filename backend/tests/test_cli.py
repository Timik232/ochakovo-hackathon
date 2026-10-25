"""Operator CLI safety and password handling; all identities are synthetic."""

import builtins
import getpass
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.cli import main
from app.config import get_settings
from app.models import AuditEvent, Employee, PrivacyConfig
from app.security.passwords import hash_password, verify_password
from tests.t2_support import employee, policy
from tests.t2_support import t2_db as t2_db
from tests.t2_support import t2_engine as t2_engine


def _prompts(monkeypatch: pytest.MonkeyPatch, password: str = "Synthetic pass 12345") -> None:
    names = iter(["Тест", "Оператор", "Тестовая должность"])
    monkeypatch.setattr(builtins, "input", lambda _: next(names))
    monkeypatch.setattr(getpass, "getpass", lambda _: password)


def test_password_argon2id() -> None:
    password = "  Тестовый пароль 123  "
    encoded = hash_password(password)
    assert encoded.startswith("$argon2id$v=19$m=65536,t=3,p=4$")
    assert verify_password(password, encoded)
    assert not verify_password(password.strip(), encoded)
    assert encoded != hash_password(password)
    assert not verify_password(password, None)
    assert not verify_password(password, encoded + "garbage")
    assert not verify_password(password, "$not-a-valid-hash")
    for invalid in ("short", "x" * 129):
        with pytest.raises(ValueError):
            hash_password(invalid)


def test_bootstrap_idempotent(
    t2_engine: Engine, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    _prompts(monkeypatch)
    assert main(["bootstrap-admin", "--email", "  ADMIN@example.test  "]) == 0
    with Session(t2_engine) as db:
        admin = db.scalar(select(Employee))
        assert admin is not None and admin.role == "admin" and admin.state == "active"
        original = admin.password_hash
        original_id = admin.id
    _prompts(monkeypatch, "Different pass 54321")
    assert main(["bootstrap-admin", "--email", "other@example.test"]) == 1
    with Session(t2_engine) as db:
        rows = list(db.scalars(select(Employee)))
        assert len(rows) == 1 and rows[0].id == original_id and rows[0].password_hash == original
        audit = db.scalar(select(AuditEvent))
        assert audit is not None and audit.changed_fields == ["role", "state"]
    output = capsys.readouterr()
    assert "already exists" in output.err
    assert "Synthetic pass" not in output.out + output.err


def test_promote_and_reset(t2_engine: Engine, monkeypatch: pytest.MonkeyPatch) -> None:
    with Session(t2_engine) as db:
        employee(db, role="staff")
        db.commit()
    assert main(["promote-admin", "--email", "operator@example.test"]) == 0
    _prompts(monkeypatch)
    assert main(["reset-admin-password", "--email", "operator@example.test"]) == 0
    with Session(t2_engine) as db:
        admin = db.scalar(select(Employee))
        assert admin is not None and admin.must_change_password
        assert verify_password("Synthetic pass 12345", admin.password_hash)


def test_bootstrap_password_stdin_not_argv(t2_engine: Engine) -> None:
    # getpass falls back to stdin without a TTY; the synthetic secret never enters argv/env.
    password = "Synthetic stdin 12345"
    result = subprocess.run(
        [sys.executable, "-m", "app.cli", "bootstrap-admin", "--email", "stdin@example.test"],
        input=f"Тест\nОператор\nТестовая должность\n{password}\n{password}\n",
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0
    assert password not in result.stdout + result.stderr
    with Session(t2_engine) as db:
        admin = db.scalar(select(Employee))
        assert admin is not None and verify_password(password, admin.password_hash)


def test_cli_privacy_activation_files(
    t2_engine: Engine, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    notice, consent = tmp_path / "notice.txt", tmp_path / "consent.txt"
    notice.write_text("Synthetic notice", encoding="utf-8")
    consent.write_text("Synthetic consent", encoding="utf-8")
    answers = iter(["Synthetic operator", str(notice), str(consent), "1", "30", "yes", "yes"])
    monkeypatch.setattr(builtins, "input", lambda _: next(answers))
    monkeypatch.setenv("APP_ORIGIN", "https://example.test")
    get_settings.cache_clear()
    try:
        assert main(["privacy-activate"]) == 0
        with Session(t2_engine) as db:
            config = db.get(PrivacyConfig, 1)
            assert config is not None and config.collection_enabled and config.revision == 1
    finally:
        get_settings.cache_clear()


@pytest.mark.parametrize("env", ["production", "development", "prod"])
def test_seed_refuses_production(
    monkeypatch: pytest.MonkeyPatch, env: str, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("APP_ENV", env)
    get_settings.cache_clear()
    try:
        assert main(["seed-demo"]) == 1
        assert "refused" in capsys.readouterr().err
    finally:
        get_settings.cache_clear()


def test_seed_demo_and_cleanup(t2_engine: Engine, monkeypatch: pytest.MonkeyPatch) -> None:
    with Session(t2_engine) as db:
        policy(db)
        db.commit()
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    try:
        assert main(["seed-demo", "--count", "3"]) == 0
        assert main(["cleanup"]) == 0
    finally:
        get_settings.cache_clear()


def test_cli_http_privacy_activation(
    t2_engine: Engine, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    notice, consent = tmp_path / "notice.txt", tmp_path / "consent.txt"
    notice.write_text("Synthetic notice", encoding="utf-8")
    consent.write_text("Synthetic consent", encoding="utf-8")
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("APP_ORIGIN", "http://localhost:18121")
    get_settings.cache_clear()
    try:
        for flags, expected in [([], 1), (["--allow-http-origin"], 0)]:
            answers = iter(["Test operator", str(notice), str(consent), "1", "30", "yes", "yes"])
            monkeypatch.setattr(builtins, "input", lambda _, answers=answers: next(answers))
            assert main(["privacy-activate", *flags]) == expected
        with Session(t2_engine) as db:
            config = db.get(PrivacyConfig, 1)
            assert config is not None and config.collection_enabled
    finally:
        get_settings.cache_clear()
