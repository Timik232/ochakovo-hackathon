# Архитектура

## Обзор

Система учёта кандидатов «Очаково» — модульный монолит из двух частей в одном
репозитории:

```
клиент (браузер) ──HTTP──> Nginx (single origin)
                            ├── статика фронтенда (React SPA)
                            └── /api/ → FastAPI (uvicorn)
                                       └── PostgreSQL 17
```

Ключевые решения (контракт плана, обязательны для всех задач):

- **Single origin, без CORS.** В production статика фронтенда и `/api/`
  обслуживаются одним Nginx. В разработке Vite проксирует `/api` на
  `http://127.0.0.1:8000`. Фронтенд всегда использует **относительные** URL
  (`/api/...`) — абсолютные адреса API запрещены во всех окружениях.
- **Backend**: Python 3.12, FastAPI, Pydantic 2, SQLAlchemy 2 **sync** (сессия
  на запрос), psycopg 3, Alembic, PostgreSQL 17. Обработчики с БД — `def`,
  без блокирующих обращений к БД внутри `async def`.
- **Frontend**: React 19 + TypeScript strict (без `any`), Vite, React Router 7
  в declarative-режиме (без SSR и data-режима), TanStack Query 5, React Hook
  Form + Zod 4, CSS Modules + CSS variables. Без тяжёлых UI-китов.
- **Слой API**: префикс `/api/v1` для доменных ресурсов, `/api/health/*` для
  проверок. Контракты описываются Pydantic-схемами со стабильными
  `operationId`. TypeScript-типы генерируются из OpenAPI
  (`openapi-typescript`), запросы — через `openapi-fetch`.
- **Время**: хранение UTC `timestamptz`, отображение Europe/Moscow с явной
  подписью; date-only значения — тип `date`.

## Структура репозитория

```
backend/
  app/main.py        фабрика create_app() — используется тестами и экспортом OpenAPI
  app/config.py      pydantic-settings: все настройки из env со значениями по умолчанию
  app/db.py          engine + фабрика сессий (DATABASE_URL из настроек)
  app/api/           роутеры (health, далее auth/candidates/...)
  scripts/           export_openapi.py — экспорт OpenAPI без подключения к БД
  tests/             pytest (TestClient + живая тестовая PostgreSQL)
frontend/
  src/app/           провайдеры (TanStack Query) и роутер
  src/pages/         страницы
  src/features/      доменные фичи (появляются в следующих задачах)
  src/shared/        ui-компоненты, стили, утилиты
  src/api/           типизированный клиент + сгенерированный schema.d.ts
  tests/             Vitest + Testing Library + MSW
docs/                architecture.md, api.md
e2e/                 спецификации Playwright (стек — с T11)
```

## Конвейер контракта API

1. Backend-код (Pydantic-схемы и роутеры) — единственный источник истины.
2. `cd backend && uv run python -m scripts.export_openapi` → `backend/openapi.json`
   (без обращения к БД — фабрика приложения не подключается к PostgreSQL при
   импорте).
3. `cd frontend && npm run api:generate` → `src/api/schema.d.ts` (хранится в
   репозитории).
4. `npm run api:check` перегенерирует во временный файл и завершается с
   ненулевым кодом при расхождении — дрейф контракта ловится до сборки.

## Окружения

| Окружение | API-URL | БД |
|---|---|---|
| dev | Vite proxy `/api` → `127.0.0.1:8000` | локальная/тестовая PostgreSQL |
| test (unit/integration) | TestClient / MSW | одноразовый postgres:17 на `127.0.0.1:15432` (`make test-up`) |
| e2e (с T11) | через тестовый ingress (single origin) | контейнер тестового стека |
| production (с T11/T12) | тот же origin, Nginx | контейнер compose, порты БД не публикуются |

Порты `18120`/`18121` зарезервированы под production/test ingress (T11/T12);
тестовая PostgreSQL занимает только `15432` на loopback.

## Тестирование

- **Backend**: pytest; health и дальнейшие интеграционные тесты бегут против
  одноразовой PostgreSQL 17 из `make test-up`; БД по умолчанию
  `postgresql+psycopg://postgres:test@127.0.0.1:15432/postgres`, переопределяется
  переменной `DATABASE_URL`. SQLite-подмена запрещена контрактом.
- **Frontend**: Vitest + @testing-library/react; сетевой слой в тестах — MSW
  (хендлеры в `frontend/tests/msw-handlers.ts`, необработанные запросы — ошибка).
- **E2E**: Playwright Test из корня (`npm run test:e2e`), базовый URL из
  `E2E_BASE_URL`; полный тестовый стек подключается в T11.
- **`make verify`**: ruff + mypy + pytest (backend), lint + typecheck +
  api:check + Vitest + build (frontend); сам поднимает и убирает тестовую БД.
