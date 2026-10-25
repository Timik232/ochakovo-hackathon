"""Экспорт OpenAPI-схемы в backend/openapi.json без обращения к БД.

Схему использует фронтенд: npm run api:generate / api:check.
Запуск: uv run python -m scripts.export_openapi
"""

import json
from pathlib import Path

from app.main import create_app

OUTPUT = Path(__file__).resolve().parent.parent / "openapi.json"


def main() -> None:
    """Генерирует openapi.json из фабрики приложения (подключение к БД не нужно)."""
    app = create_app()
    schema = app.openapi()
    OUTPUT.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"OK: {OUTPUT}")


if __name__ == "__main__":
    main()
