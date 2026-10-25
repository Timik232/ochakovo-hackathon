TEST_PG_NAME := ochakovo-candidates-test-pg
TEST_PG_PORT := 15432
TEST_DATABASE_URL := postgresql+psycopg://postgres:test@127.0.0.1:$(TEST_PG_PORT)/postgres
TEST_DB_ENV := DATABASE_URL=$(TEST_DATABASE_URL) T2_DISPOSABLE_DB=yes

SHELL := /bin/bash
.ONESHELL:

.PHONY: help verify test-backend test-frontend test-e2e test-up test-down

help: ## Показать список целей
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

verify: test-up ## Полная проверка без e2e: lint + типы + unit/integration тесты
	set -e
	trap '$(MAKE) --no-print-directory test-down' EXIT
	$(MAKE) test-backend
	$(MAKE) test-frontend
	echo "verify: OK (lint + typecheck + unit, без e2e)"

test-backend: ## Backend: ruff + mypy + pytest (требует make test-up)
	cd backend && $(TEST_DB_ENV) uv run ruff check . && $(TEST_DB_ENV) uv run mypy app && $(TEST_DB_ENV) uv run pytest

test-frontend: ## Frontend: lint + typecheck + api:check + Vitest + build
	cd frontend && npm run lint && npm run typecheck && npm run api:check && npm run test:run && npm run build

test-e2e: ## Playwright E2E (полный тестовый стек подключается в T11)
	npm run test:e2e

test-up: ## Одноразовая PostgreSQL 17 на 127.0.0.1:15432 для тестов
	if ss -ltnH | grep -q ':$(TEST_PG_PORT) '; then \
		if docker ps --format '{{.Names}}' | grep -qx '$(TEST_PG_NAME)'; then \
			echo "test PG уже работает: $(TEST_PG_NAME)"; \
		else \
			echo "ОШИБКА: порт $(TEST_PG_PORT) занят процессом, отличным от $(TEST_PG_NAME):"; \
			ss -ltnH | grep ':$(TEST_PG_PORT) '; \
			exit 1; \
		fi; \
	else \
		echo "Запуск postgres:17 как $(TEST_PG_NAME) на 127.0.0.1:$(TEST_PG_PORT)..."; \
		docker run -d --name $(TEST_PG_NAME) -e POSTGRES_PASSWORD=test -p 127.0.0.1:$(TEST_PG_PORT):5432 postgres:17 >/dev/null; \
	fi
	for i in $$(seq 1 60); do \
		if docker exec $(TEST_PG_NAME) pg_isready -U postgres -q >/dev/null 2>&1; then \
			echo "test PG готов (попытка $$i)"; \
			exit 0; \
		fi; \
		sleep 1; \
	done
	echo "test PG не готов за 60 секунд, последние логи:"; \
	docker logs --tail 20 $(TEST_PG_NAME); \
	exit 1

test-down: ## Остановить и удалить тестовую PostgreSQL
	docker rm -f $(TEST_PG_NAME) >/dev/null 2>&1 || true
	echo "test PG остановлен и удалён"

# Jenkins build inputs (not local build targets): backend context=backend,
# frontend context=REPO ROOT (.) with Dockerfile=frontend/Dockerfile.
DEPLOY_ENV ?= deploy/.env
COMPOSE_TEST_PROJECT ?= ochakovo-candidates-test
TEST_COMPOSE = docker compose --env-file $(DEPLOY_ENV) -p "$(COMPOSE_TEST_PROJECT)" -f deploy/docker-compose.test.yml
PROD_COMPOSE = docker compose --env-file $(DEPLOY_ENV) -f deploy/docker-compose.yml
.PHONY: compose-test-up compose-test-down compose-config backup-now restore-list release-tag

compose-config: ## Validate both image-based compose files without launching containers
	set -e
	docker compose --env-file deploy/.env.example -f deploy/docker-compose.yml --profile maintenance config
	docker compose --env-file deploy/.env.example -f deploy/docker-compose.test.yml --profile maintenance config

compose-test-up: ## Start ONLY isolated test-prefix project, with Jenkins-built images
	set -e
	case "$(COMPOSE_TEST_PROJECT)" in ochakovo-candidates-test|ochakovo-candidates-test-*) ;; *) echo 'Refusing non-test project'; exit 1;; esac
	bash deploy/check-start.sh
	$(TEST_COMPOSE) up -d

compose-test-down: ## Stop ONLY isolated test-prefix project; keep its volume
	set -e
	case "$(COMPOSE_TEST_PROJECT)" in ochakovo-candidates-test|ochakovo-candidates-test-*) ;; *) echo 'Refusing non-test project'; exit 1;; esac
	$(TEST_COMPOSE) down

backup-now: ## Encrypted one-shot backup, no private age identity required
	$(PROD_COMPOSE) --profile maintenance run --rm --no-deps maintenance bash /opt/maintenance/backup.sh

restore-list: ## List encrypted filenames only; does not restore anything
	$(PROD_COMPOSE) --profile maintenance run --rm --no-deps maintenance bash /opt/maintenance/restore.sh --list

release-tag: ## UTC release timestamp + source-input SHA (no Git required)
	@set -euo pipefail
	hash=$$(find backend frontend deploy scripts Makefile .dockerignore \( -type d \( -name node_modules -o -name .venv -o -name dist -o -name __pycache__ -o -name '.*cache*' -o -name junit -o -name 'backups*' -o -name 'secrets*' -o -name test-results -o -name playwright-report \) -prune \) -o \( -type f ! -name '.env' ! -name '.env.*' ! -name '*.key' ! -name '*.age' ! -name '*.tsbuildinfo' ! -name '*junit.xml' -print \) | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -c1-8)
	printf '%s-%s\n' "$$(date -u +%Y%m%dT%H%M%SZ)" "$$hash"
