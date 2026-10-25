# Очаково — Кадровый журнал

Самостоятельное приложение учёта кандидатов: публичная анкета, рабочий кабинет
сотрудников, единый реестр кандидатов, администрирование допуска.

Монорепозиторий:

| Каталог | Что внутри |
|---|---|
| `backend/` | FastAPI + SQLAlchemy 2 (sync) + PostgreSQL 17, Python 3.12 (uv), Alembic, ruff, mypy, pytest |
| `frontend/` | React 19 + TypeScript strict + Vite, React Router 7 (declarative), TanStack Query 5, React Hook Form + Zod 4, CSS Modules, ESLint + Prettier, Vitest + Testing Library + MSW |
| `deploy/` | Docker Compose (prod/test/demo), nginx-конфиг, maintenance-скрипты, `.env.example` |
| `docs/` | `architecture.md` — архитектура, `api.md` — контракты API, `operations.md`, `backup-restore.md`, `privacy-activation.md` |
| `e2e/` | Спецификации Playwright (полный стек подключается в T11) |

Контракт API генерируется из кода backend: `backend/openapi.json` →
`frontend/src/api/schema.d.ts` (openapi-typescript). Дрейф ловит `npm run api:check`.

## Скриншоты

Снятые на синтетическом демо-стеке (тестовые данные, не реальные кандидаты):

| Экран | Файл |
|---|---|
| Публичный лендинг вакансий | [`docs/screenshots/task-parity-a-landing.png`](docs/screenshots/task-parity-a-landing.png) |
| Анкета (мобильная 390px) | [`docs/screenshots/task-parity-b-apply-390.png`](docs/screenshots/task-parity-b-apply-390.png) |
| Рабочий кабинет сотрудника (1440px) | [`docs/screenshots/task-parity-b-staff-1440.png`](docs/screenshots/task-parity-b-staff-1440.png) |
| Реестр кандидатов со статус-бейджами | [`docs/screenshots/task-redeploy-r2-badges.png`](docs/screenshots/task-redeploy-r2-badges.png) |

## Предварительные требования

- `uv` >= 0.12
- Node.js >= 22.12 и npm
- Docker (образы Docker Hub идут через настроенное на хосте зеркало)

## Быстрый старт

### Тестовая база данных (одноразовый PostgreSQL 17)

```bash
make test-up    # postgres:17 в контейнере ochakovo-candidates-test-pg, 127.0.0.1:15432
make test-down  # остановить и удалить контейнер
```

### Backend

```bash
cd backend
uv sync --frozen
uv run pytest
```

Dev-сервер (http://127.0.0.1:8000):

```bash
uv run uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm ci
npm run build
```

Dev-сервер (http://127.0.0.1:5173, `/api` проксируется на backend :8000):

```bash
npm run dev
```

### Полная проверка (lint + типы + unit/integration, без e2e)

```bash
make verify
```

`verify` сам поднимает тестовую БД и убирает её за собой.

### Контракт API (OpenAPI → TypeScript)

```bash
cd backend  && uv run python -m scripts.export_openapi   # backend/openapi.json, БД не нужна
cd frontend && npm run api:generate                      # src/api/schema.d.ts (хранится в репозитории)
cd frontend && npm run api:check                         # ненулевой код при дрейфе
```

## Развёртывание (образы только через Jenkins)

Упаковка: `deploy/docker-compose.yml`, отдельный тестовый проект
`deploy/docker-compose.test.yml`, параметры `deploy/.env.example`.
`make compose-config` проверяет оба файла без запуска/сборки.
API Dockerfile использует context `backend`; frontend Dockerfile требует
**корень репозитория** (OpenAPI из `backend/openapi.json`). На .48 ничего не
собирать. После Jenkins: скопировать пример env в защищённый deploy/.env,
выполнить capacity guard и команды из [operations.md](docs/operations.md).
T11-B проверил отдельный HTTP test-stack, E2E, security и backup/restore.
Production HTTPS/privacy gates и приёмка владельцем остаются в T12.

`make compose-test-up/down` работает только с отдельным test-префиксом и
loopback18121; это не make verify/test-up на15432. Передавайте
`DEPLOY_ENV=deploy/.env.test`: только в test/development явный `COOKIE_SECURE=false`
разрешает сессионные cookie по HTTP; production всегда принудительно Secure.
`make backup-now` и
`make restore-list` используют maintenance. Полная инструкция ключей и
изолированного восстановления: [backup-restore.md](docs/backup-restore.md).
**Никогда не выполнять production down -v.**
