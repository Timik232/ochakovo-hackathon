# Очаково — система приёма кандидатов

HR-система для приёма кандидатов на работу в «Очаково». Кандидат заполняет публичную анкету и получает статус «анкета», а сотрудник ведёт кандидата в рабочем кабинете с внутренними полями. Реестр поддерживает поиск, фильтры и этапы; предусмотрены роли staff/admin, архив, экспорт CSV и QR-код.

## Стек

- **Backend:** FastAPI, SQLAlchemy 2, psycopg 3, Alembic, PostgreSQL 17.
- **Frontend:** React 19, TypeScript, Vite, TanStack Query, React Hook Form, Zod.
- **Проверки:** pytest, Vitest, Playwright; `make verify` объединяет lint, проверки типов и unit/integration-тесты.

## Быстрый старт

Нужны Docker с Compose и доступ к интернету для загрузки базовых образов и зависимостей.

1. Создайте локальный файл настроек и задайте значения секретов по комментариям в нём:

   ```bash
   cp deploy/.env.example deploy/.env
   ```

   Как минимум замените `POSTGRES_PASSWORD`, задайте такой же пароль в `DATABASE_URL` и укажите случайное значение `SUBMISSION_HMAC_SECRET` длиной не менее 32 байт. Для локального HTTP-запуска задайте `APP_ORIGIN=http://localhost:18120` и `COOKIE_SECURE=false`.

2. Соберите образы из корня репозитория. Для frontend корень — обязательный build context: Dockerfile использует `backend/openapi.json`.

   ```bash
   docker build -f backend/Dockerfile -t ochakovo-candidates-api:local backend
   docker build -f frontend/Dockerfile -t ochakovo-candidates-web:local .
   ```

3. Compose-файл по умолчанию ссылается на релизные образы. Для локальных образов подключите идущий в репозитории override `deploy/docker-compose.local-images.yml`:

   ```bash
   docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local-images.yml \
     --env-file deploy/.env up -d
   ```

   Сервис `migrate` автоматически выполняет миграции до запуска API. Веб-приложение будет доступно по адресу `http://localhost:${INGRESS_PORT:-18120}` (по умолчанию — `http://localhost:18120`).

## Первый вход

Создайте первого администратора интерактивно:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local-images.yml \
  --env-file deploy/.env exec -it api python -m app.cli bootstrap-admin
```

Активация приёма анкет требует заполненной политики конфиденциальности и подтверждения полномочий оператора. Для локального демонстрационного окружения выполните команду в контейнере API:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.local-images.yml \
  --env-file deploy/.env exec -e APP_ENV=development \
  -e APP_ORIGIN=http://localhost:18120 -e COOKIE_SECURE=false \
  -it api python -m app.cli privacy-activate
```

Следуйте интерактивным запросам CLI; не включайте приём реальных персональных данных без надлежащих оснований и настроенной политики.

## Тесты и проверки

- `make verify` — полная проверка backend и frontend без E2E; цель поднимает тестовую PostgreSQL и удаляет её после завершения.
- `cd backend && uv run pytest` — тесты backend (для полного набора требуется тестовая база; `make test-up` поднимает её, `make test-down` останавливает).
- `cd frontend && npm ci && npm run test:run` — тесты frontend через Vitest.
- Playwright E2E запускаются целью `make test-e2e`.

## Скриншоты

Снятые на синтетическом демо-стеке (тестовые данные, не реальные кандидаты):

| Экран | Файл |
|---|---|
| Публичный лендинг вакансий | [`docs/screenshots/task-parity-a-landing.png`](docs/screenshots/task-parity-a-landing.png) |
| Анкета (мобильная 390px) | [`docs/screenshots/task-parity-b-apply-390.png`](docs/screenshots/task-parity-b-apply-390.png) |
| Рабочий кабинет сотрудника (1440px) | [`docs/screenshots/task-parity-b-staff-1440.png`](docs/screenshots/task-parity-b-staff-1440.png) |
| Реестр кандидатов со статус-бейджами | [`docs/screenshots/task-redeploy-r2-badges.png`](docs/screenshots/task-redeploy-r2-badges.png) |

## Структура репозитория

- `backend/` — API, модели данных, миграции и CLI.
- `frontend/` — веб-интерфейс.
- `deploy/` — Compose-файлы, конфигурация веб-сервера и пример переменных окружения.
- `docs/` — архитектура, API, эксплуатационные заметки и скриншоты.
- `e2e/` — сценарии Playwright.
