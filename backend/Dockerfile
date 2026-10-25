# Legacy builder: Jenkins CONTEXT=backend (no BuildKit features).
FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg age tini util-linux && mkdir -p /usr/share/postgresql-common/pgdg && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc && printf '%s\n' 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main' > /etc/apt/sources.list.d/pgdg.list && apt-get update && apt-get install -y --no-install-recommends postgresql-client-17 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv==0.12.1 && useradd --create-home --uid 10001 app
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health/live', timeout=3)"
ENTRYPOINT ["/usr/bin/tini", "--"]
# No uvicorn access log: query tokens must never appear in logs. Trust no forwarded headers.
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--no-access-log", "--no-proxy-headers"]
