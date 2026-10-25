# Privacy activation — gate B (owner-owned)

Production intake (`POST /api/v1/public/applications` and public staff registration) returns
**503 INTAKE_DISABLED** until this gate is explicitly completed. The agent must NOT enable real
collection; activation is an owner/operator action with legal responsibility. HTTPS (gate A)
never enables intake by itself.

## Checklist — all items required BEFORE activation

Each item must have a real, current value. No legal guarantees are made by the agent or this
document; the owner confirms authority and accepts responsibility interactively.

- [ ] **Оператор (operator identity)**: actual legal entity/person responsible for processing
      (ФИО или наименование организации). Stored in `privacy_config.operator_identity` and shown
      implicitly via policy provenance.
- [ ] **Основание и согласие (basis & consent)**: the privacy notice text (`notice`) and the
      consent text (`consent`) the applicant accepts by submitting the form. Must state purpose,
      data categories, retention, applicant rights.
- [ ] **Retention (срок хранения)**: retention days 1–365. Expired candidates are removed by
      `python -m app.cli cleanup` (run it on a schedule after activation).
- [ ] **Правомерность домашнего хостинга (domestic hosting legality)**: owner confirms that
      processing real applicants' personal data on a home server (192.168.1.48, Russian
      jurisdiction LAN) is acceptable for their obligations.
- [ ] **Доступ и безопасность (access & security)**: who has admin/staff accounts, how passwords
      are managed, that sessions/CSRF/audit are as described in docs/architecture.md.
- [ ] **Backup keys legal ack**: encrypted backups exist locally; the age identity
      (`deploy/secrets/age-identity`) MUST be copied off-host by the owner — backups are
      unrecoverable if the host dies with the only key copy.

## Activation procedure (production, after gate A verified and checklist complete)

```bash
cd /DATA/AppData/ochakovo-candidates/deploy
docker compose --env-file .env exec -it api python -m app.cli privacy-activate
```

Interactive prompts: operator identity; path to notice file and consent file (mounted or typed
via container-local files); revision (start 1; ANY later text change requires a HIGHER
revision); retention days; and two explicit `yes` confirmations (legal authority + verified
HTTPS origin). Production requires a verified HTTPS APP_ORIGIN — the `--allow-http-origin`
escape hatch is refused in production (only test/development).

After activation the public form opens, the privacy screen shows notice/consent/revision, and
staff candidate mutations become available.

## Synthetic-smoke-then-delete rule

Immediately after ANY activation (production or demo), verify with SYNTHETIC data only:

1. Submit one clearly-marked synthetic application through `/apply`
   (e.g. last name `ТЕСТ-СМАОК`, phone +7 999 …). Expect 201 «Анкета принята».
2. Confirm it appears in the staff list, then DELETE it (admin, `If-Match` version header).

Real applicant data must never be used for smoke tests. The smoke record must be deleted
before real collection begins; audit keeps only field-name metadata of the deletion, no PII.

## Deactivation / kill switch

Admin API `POST /api/v1/admin/intake/disable` stops collection immediately (audited).
Re-enabling is deliberately CLI-only (this procedure) — there is no web re-enable.

## Demo stack policy (reference)

The demo stack (18121) runs with SYNTHETIC notice/consent texts and `--allow-http-origin`
(allowed in its APP_ENV=test): it demonstrates the form flow, nothing more. Demo data is wiped
at cutover (`docker compose -f docker-compose.demo.yml --env-file .env.demo down -v`).
