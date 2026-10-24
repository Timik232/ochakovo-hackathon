FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

# Приложение без зависимостей: только package.json, server.js и статика
COPY package.json server.js ./
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# BOT_TOKEN прилетает из Vault sidecar'ом в /etc/vault/secrets.env: ждём файл, подхватываем, стартуем
ENTRYPOINT ["/bin/sh", "-c", "for i in $(seq 1 30); do [ -f /etc/vault/secrets.env ] && break; sleep 2; done; set -a; . /etc/vault/secrets.env 2>/dev/null; set +a; exec node server.js"]
