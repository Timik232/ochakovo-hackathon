#!/usr/bin/env bash
# Jenkins-only disposable services; all names are scoped to this gate build.
set -euo pipefail
API_NAME="ochakovo-gate-api-${BUILD_NUMBER}"
WEB_NAME="ochakovo-gate-web-${BUILD_NUMBER}"
E2E_NAME="ochakovo-gate-e2e-${BUILD_NUMBER}"
API_PORT=$((22000 + BUILD_NUMBER * 2))
WEB_PORT=4173
export E2E_API_TARGET="http://127.0.0.1:${API_PORT}"
export PLAYWRIGHT_BASE_URL="http://localhost:${WEB_PORT}"
cleanup() {
  docker logs "$API_NAME" 2>&1 || true
  docker logs "$WEB_NAME" 2>&1 || true
  docker rm -f "$API_NAME" "$WEB_NAME" "$E2E_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker exec "$PG_NAME" createdb -U postgres e2e
docker run -d --name "$API_NAME" --network host \
  -v "$GATE_HOST_DIR/backend:/work" -w /work \
  -e DATABASE_URL="postgresql+psycopg://postgres:test@127.0.0.1:${PG_PORT}/e2e" \
  -e APP_ENV=test -e COOKIE_SECURE=false -e APP_ORIGIN="$PLAYWRIGHT_BASE_URL" \
  -e SUBMISSION_HMAC_SECRET=synthetic-gate-only-hmac-secret-at-least-32-bytes \
  python:3.12-slim bash -euc '
    export PATH="/work/.venv/bin:$PATH"
    alembic upgrade head
    printf "Test\nAdmin\nSynthetic operator\nпароль-надёжный-12\nпароль-надёжный-12\n" | python -m app.cli bootstrap-admin --email admin@demo.example.test
    printf "Synthetic test notice" > /tmp/notice
    printf "Synthetic test consent" > /tmp/consent
    printf "Synthetic operator\n/tmp/notice\n/tmp/consent\n1\n30\nyes\nyes\n" | python -m app.cli privacy-activate --allow-http-origin
    python -m app.cli seed-demo --count 45
    exec uvicorn app.main:create_app --factory --host 127.0.0.1 --port '"$API_PORT"' --no-access-log --no-proxy-headers
  '
docker run -d --name "$WEB_NAME" --network host \
  -v "$GATE_HOST_DIR:/workspace" -w /workspace/frontend \
  -e E2E_API_TARGET node:22.13.0-bookworm-slim \
  sh -ec "npx vite preview --host 127.0.0.1 --port $WEB_PORT --strictPort"
docker run --rm --name "$E2E_NAME" --network host \
  -v "$GATE_HOST_DIR:/workspace" \
  -v /DATA/AppData/jenkins/home/.cache/ochakovo-npm:/root/.npm \
  -w /workspace -e CI=1 -e PLAYWRIGHT_BASE_URL \
  -e PLAYWRIGHT_JUNIT_OUTPUT_FILE=/workspace/e2e-junit.xml \
  -e E2E_EVIDENCE_DIR=/workspace/e2e-evidence \
  mcr.microsoft.com/playwright:v1.56.0-noble bash -euc '
    npm ci --prefer-offline --no-audit --no-fund
    node -e '\''(async()=>{for(let i=0;i<90;i++){try{let r=await fetch(process.env.PLAYWRIGHT_BASE_URL+"/api/health/ready");if(r.ok) return;}catch{} await new Promise(r=>setTimeout(r,1000));}process.exit(1)})()'\''
    npx playwright test --reporter=list,junit
  '
