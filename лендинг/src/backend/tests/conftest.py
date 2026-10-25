"""Общие настройки тестов.

До первого импорта приложения задаёт DATABASE_URL тестовой PostgreSQL
(make test-up, порт 15432). Переменную можно переопределить извне.
"""

import os

TEST_DATABASE_URL = "postgresql+psycopg://postgres:test@127.0.0.1:15432/postgres"

os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL)
