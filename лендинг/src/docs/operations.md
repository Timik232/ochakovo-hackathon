# Operations — production deployment (T12)

Production runs on the home server (192.168.1.48) from `/DATA/AppData/ochakovo-candidates/deploy`.
Everything below was verified on 2026-10-24/25 UTC except the two owner-owned gates (A: external HTTPS
route, B: privacy/legal activation) which are **PENDING** by design.

## Deployment state (T12, 2026-10-25)

| Stack | Project / compose | Ingress | State |
|---|---|---|---|
| Production | `ochakovo-candidates` · `deploy/docker-compose.yml` + `deploy/.env` | `http://192.168.1.48:18120` (web, LAN; DB/API unpublished) | Up, healthy, intake OFF |
| Demo (synthetic) | `ochakovo-candidates-demo` · `deploy/docker-compose.demo.yml` + `deploy/.env.demo` | `http://192.168.1.48:18121` (LAN-open, 0.0.0.0) | Up, 47 synthetic candidates |
| Test (T11) | `ochakovo-candidates-test` · `deploy/docker-compose.test.yml` | loopback 18121 when up | **Down**, volume retained |

Predecessor prototype `ochakovo-career` (port 8481) keeps running until owner cutover; it is unrelated to this app's containers.

## Images and context

Only Jenkins image-builder builds images. API: `backend/Dockerfile`, context `backend`.
Web: `frontend/Dockerfile`, context **repository root `.`**. Use `make release-tag`
(UTC timestamp + source hash); never `latest`. Both stacks promote the SAME verified release:

**Immutable release: 20261025T020740Z-9827e32a** (rebuilt via Jenkins #49/#51 for the
round-2 fixes: schema-head readiness, numeric registry badges, regenerated API types;
deployment acceptance is recorded in evidence `task-redeploy-r2.txt`).

| Image at `192.168.1.47:7002/` | Jenkins image-builder | Registry manifest digest |
|---|---|---|
| `ochakovo-candidates-api:20261025T020740Z-9827e32a` | #49 SUCCESS | `sha256:d4c1a76c2b00acd2b16a1d9bbd3838c681a2a3a39b2c91728b5206b8775564d6` |
| `ochakovo-candidates-web:20261025T020740Z-9827e32a` | #51 SUCCESS | `sha256:bf2e9b264f763e3bc95ee9d6cabfdda5c2cb3c34f94959cb24ed4d86c401fa49` |

Database image pinned in both env files:
`DB_IMAGE=postgres:17@sha256:b8faeff7712663c2773a190181e1246e37e364b887611c04658c28b44e2408fe`
(canonical Docker Hub multi-arch index digest, queried 2026-10-24).

Predecessor release `20261024T211331Z-c87b8d9e` passed the T11 container suite: gate #13 SUCCESS
(backend 303 / frontend 116 / Playwright 4), curl full-flow, hostile battery 9/9, backup+restore
drill. The previous `20261025T010636Z-81110c64` release remains on the host for rollback;
its acceptance is recorded in `task-redeploy.txt`. Round-2 acceptance uses migration exit 0
(no-op at Alembic head `a5f2e8d01c9b`), live schema-aware readiness and the curl smoke battery,
plus real-browser registry badge checks (`task-redeploy-r2.txt`). No production schema was
modified to exercise negative readiness paths. Any input change requires a NEW Jenkins
build AND a full container-suite re-run before production use.

## Production stack

```bash
cd /DATA/AppData/ochakovo-candidates/deploy
bash check-start.sh                                   # >=2 GiB RAM / >=5 GiB disk, read-only
docker compose --env-file .env up -d                  # migrate one-shot gates api start
curl --fail http://127.0.0.1:18120/api/health/ready   # {"status":"ok","database":"up"}
```

Verified at deployment: migrate exit 0, Alembic head `a5f2e8d01c9b` = repo head; anonymous
`/api/v1/candidates` → 401; `/` and `/apply` → 200; public privacy `collection_enabled=false`;
`POST /api/v1/public/applications` → 503 `INTAKE_DISABLED` (collection off by default);
`employees=vacancies=candidates=0` (no admin bootstrapped); DB has NO published port;
`docker compose restart api web` retains schema and data; memory caps 512m db / 512m api / 128m web.

Production secrets (machine-local, NEVER in git/archives/evidence):
- `deploy/.env` (0600): pinned IMAGE_TAG/DB_IMAGE, POSTGRES_PASSWORD, DATABASE_URL, stable
  SUBMISSION_HMAC_SECRET (>=32 bytes), APP_ORIGIN=https://ochakovo.komolov.synology.me,
  INGRESS_PORT=18120, public BACKUP_AGE_RECIPIENT=age1z0fuv4895yygeqrzg6xwvpkwr5kj570qpxntp95hhh8nrhqg7cjs7t7h2e.
- `deploy/secrets/age-identity` (0600, owner ser13volk): **PRIVATE production backup identity.
  The owner MUST copy it off-host (printed copy or personal encrypted storage). If this host dies
  with the only copy, all encrypted backups are unrecoverable.**
- `deploy/secrets/pgpass` (0600, UID 10001) and `deploy/backups/` (0700, UID 10001).

### Owner bootstrap of the production admin (interactive, never scripted)

```bash
cd /DATA/AppData/ochakovo-candidates/deploy
docker compose --env-file .env exec -it api python -m app.cli bootstrap-admin --email <owner-email>
```

Prompts (getpass/input): first/last name, position, password twice (12–128 chars).
Create-only: refuses if an active admin exists. The agent did NOT create any production admin.

### Backup / restore (production)

```bash
# one-shot encrypted backup (writes deploy/backups/<stamp>.dump.age + .last_success)
docker compose --env-file .env --profile maintenance run --rm maintenance bash /opt/maintenance/backup.sh
# list archives
docker compose --env-file .env --profile maintenance run --rm maintenance bash /opt/maintenance/restore.sh --list
```

First prod backup verified: `20261024-220239.dump.age` + `.last_success`; decryption with
`deploy/secrets/age-identity` verified to /dev/null (age only; no plaintext persisted).
Full offline restore drill procedure: [backup-restore.md](backup-restore.md) (T11 executed it on
the test stack). Local backups are NOT disaster recovery — copy off-host (see age-identity note).

## Demo stack (synthetic data, LAN-open)

`http://192.168.1.48:18121` — for the owner to click through the product. **DEMO CREDENTIALS:
`demo-admin@example.test` / `demo-admin-2026` — synthetic data only, wiped at cutover, never
reuse on production.** 47 synthetic candidates (seed plus acceptance fixtures), 9 vacancies, synthetic privacy texts, intake
enabled so the public form can be tried.

Demo runs with **APP_ENV=test** (not `demo`): the released images honor `COOKIE_SECURE=false`
and `privacy-activate --allow-http-origin` only in test/development, while `seed-demo` is allowed
only in demo/test — `test` is the single env satisfying all three guards without code changes
(no rebuild; promotion-only). Production/demo-*named* envs would force Secure cookies and break
http login. Do not weaken production policy for the demo.

```bash
cd /DATA/AppData/ochakovo-candidates/deploy
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d
# teardown at cutover (destroys ONLY synthetic demo data):
docker compose -f docker-compose.demo.yml --env-file .env.demo down -v   # demo MAY be down -v'd; prod NEVER
```

Own volume `ochakovo-candidates_pgdata-demo`, own DB creds/HMAC in `deploy/.env.demo` (0600),
pgpass-demo/backups-demo owned by UID 10001. Verified: http cookie login (no Secure flag in
APP_ENV=test), `/candidates` lists synthetic rows, public submit 201, `/apply` 200 from LAN.

## Test stack (T11) — reference

```bash
make compose-test-up DEPLOY_ENV=deploy/.env.test    # loopback 18121 while demo is stopped
make compose-test-down DEPLOY_ENV=deploy/.env.test  # keeps the test volume
```

Test/demo share port 18121 — never run both simultaneously; demo currently owns it.
Test acceptance, hostile battery and the restore drill are recorded below under T11 evidence.

## Ingress / rollback

Web 18120→8080 (prod) published; DB/API never published. Only Synology 192.168.1.47 is trusted
for XFF. Uvicorn ignores forwarded headers; APP_ORIGIN sets origin policy. Query strings absent
from nginx access logs; uvicorn access logs disabled. ENABLE_HSTS stays 0 until HTTPS is verified
— prefer HSTS on the Synology edge (nginx sees plain HTTP behind the TLS-terminating proxy).

Rollback = previous IMAGE_TAG in `deploy/.env`, then `docker compose --env-file .env up -d`.
Confirm schema backward compatibility first; migrate is one-shot. No automatic Alembic downgrade.
**NEVER `down -v` on production** — it destroys the database. Demo `down -v` is allowed.

## Gate A — external HTTPS (owner action, PENDING)

DNS and certificate are READY: `ochakovo.komolov.synology.me` → WAN IP, valid wildcard Let's
Encrypt cert `*.komolov.synology.me` (expires 2026-12-07). The hostname currently hits the
Synology DSM default site (HTTP 200 redirect stub to :5001 for every path) — no reverse-proxy
route exists yet. Owner steps in Synology DSM:

1. Control Panel → Login Portal → Advanced → Reverse Proxy → Create.
2. Source: HTTPS, port 443, hostname `ochakovo.komolov.synology.me` (certificate: the existing
   `komolov.synology.me` wildcard).
3. Destination: HTTP, host `192.168.1.48`, port **18120**.
4. WebSocket support: not required. Enable "Forward client IP" if available (nginx already
   trusts only the Synology for XFF). HSTS: leave to DSM/cert settings; do NOT double-enable in app.
5. Do NOT put an Authentik/shared-auth wall in front: `/apply` and the public pages must stay
   public. Staff login protection is the app's own auth.
6. Cutover note: the old prototype stays reachable on `http://192.168.1.48:8481` (direct);
   switching the DSM route only affects the public hostname.

After the owner reports the route is live, the agent verifies: `curl --fail --show-error
https://ochakovo.komolov.synology.me/api/health/ready` (no -k) = 200, valid chain, HTTP→HTTPS
redirect, `/apply` + `/login` open in a real browser, secure cookie login works, anonymous
`/api/v1/candidates` = 401 — plus an INDEPENDENT outside-LAN probe (LAN checks do not prove
internet reachability). Until then, external delivery is honestly NOT verified.

## Gate B — privacy / personal data (owner action, PENDING)

Collection stays disabled. See [privacy-activation.md](privacy-activation.md) for the operator/
basis/consent/retention/domestic-hosting/backup-keys checklist and the activation procedure.
HTTPS (gate A) never enables intake by itself.

## T11 evidence index

`/DATA/AppData/.sisyphus/evidence/ochakovo/`: `task-11-verification.txt`, `task-11-security.txt`,
`task-11-backup.txt`, `task-11-gate.txt`, `task-11-image-{api,web}.txt`, `task-11-final-verify.txt`;
T12: `task-12-delivery.txt`, `task-12-blockers.txt`. Gate #13:
`http://192.168.1.37:18080/job/ochakovo-candidates-tests/13/` SUCCESS.
