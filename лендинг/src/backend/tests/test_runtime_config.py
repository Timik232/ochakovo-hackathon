"""HTTP is an explicit disposable-environment opt-in, never a production fallback."""

import pytest

from app.cli import main
from app.config import Settings, get_settings
from app.security.sessions import cookie_secure


@pytest.mark.parametrize(
    ("env", "override", "expected"),
    [
        ("production", "false", True),
        ("prod", "false", True),
        ("demo", "false", True),
        ("test", "false", False),
        ("development", "false", False),
        ("test", None, True),
    ],
)
def test_cookie_policy(
    monkeypatch: pytest.MonkeyPatch, env: str, override: str | None, expected: bool
) -> None:
    monkeypatch.setenv("APP_ENV", env)
    monkeypatch.delenv("COOKIE_SECURE", raising=False)
    if override is not None:
        monkeypatch.setenv("COOKIE_SECURE", override)
    get_settings.cache_clear()
    try:
        assert Settings(_env_file=None).cookie_secure is expected
        assert cookie_secure() is expected
    finally:
        get_settings.cache_clear()


@pytest.mark.parametrize("env", ["production", "prod", "demo"])
def test_http_activation_flag_refused_before_db(
    monkeypatch: pytest.MonkeyPatch, env: str, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("APP_ENV", env)
    get_settings.cache_clear()
    try:
        assert main(["privacy-activate", "--allow-http-origin"]) == 1
        assert "only test or development" in capsys.readouterr().err
    finally:
        get_settings.cache_clear()
