# REQUIRED build context: REPOSITORY ROOT, not frontend/ (../backend/openapi.json).
# Jenkins: CONTEXT=. Dockerfile=frontend/Dockerfile; legacy DOCKER_BUILDKIT=0.
FROM node:22.13.0-bookworm-slim AS builder
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/package-lock.json ./
ARG NPM_TARBALL_ORIGIN=
# Optional public mirror outage override; integrity hashes stay unchanged.
RUN if [ -n "$NPM_TARBALL_ORIGIN" ]; then node -e 'const fs=require("fs");const p="package-lock.json";const l=JSON.parse(fs.readFileSync(p));for(const v of Object.values(l.packages)){if(v.resolved)v.resolved=v.resolved.replace("https://npm-mirror.gitverse.ru/repository/registry_npmjs_org",process.env.NPM_TARBALL_ORIGIN.replace(/\/$/,""));}fs.writeFileSync(p,JSON.stringify(l));'; fi
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
COPY backend/openapi.json /workspace/backend/openapi.json
RUN npm run api:generate && npm run build
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=builder /workspace/frontend/dist /usr/share/nginx/html
# Vite includes imported brand assets/fonts in dist/assets; no external CDN needed.
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
ENV ENABLE_HSTS=0 NGINX_ENVSUBST_FILTER=ENABLE_HSTS
USER 101:101
EXPOSE 8080
