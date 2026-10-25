# Encrypted backup and offline restore

## Key custody (operator)

Generate an age identity on the operator's trusted machine (`age-keygen`); keep
the private identity **only there plus a secured printed recovery copy**. Never
put it in this repository, image, backups directory, source archive or evidence.
Put only the public `age1...` recipient into BACKUP_AGE_RECIPIENT. Losing all
private-key copies makes backups unrecoverable. Rotate recipients deliberately:
retain old identities to decrypt older files. Never print secrets in commands.

## Backup setup and execution

Provision `deploy/backups` owned by UID 10001 with mode 0700. Provision a separate
mode-0600 pgpass file readable by UID 10001 containing
`db:5432:<database>:<user>:<password>` (escape colon/backslash per libpq pgpass).
Set PGPASS_HOST_FILE to its host path. Its content never belongs in evidence.
No PGPASSWORD arguments, no private identity mount for daily backup.

```bash
make backup-now DEPLOY_ENV=deploy/.env
make restore-list DEPLOY_ENV=deploy/.env
docker compose --env-file deploy/.env -f deploy/docker-compose.yml --profile maintenance up -d maintenance
```

pg_dump 17 custom format → mode-0600 temporary dump → age encryption → atomic
rename to UTC `YYYYMMDD-HHMMSS.dump.age`. EXIT/signal traps remove plaintext;
SIGKILL/host crash cannot run traps, so inspect container /tmp after crash before
reuse (do not archive it). Only *.dump.age older than retention (default14 days)
are removed. Lock prevents parallel backup. Healthy backup is silent exit0;
failure is nonzero plus `.last_error` timestamp/filename only; `.last_success`
records successful completion. Loop runs immediately then 00:00 UTC daily,
retries once after60s, also runs app cleanup daily under a singleton lock.
Never route repeated loop stderr to chat without cooldown. Cleanup markers are
`.cleanup_success` / `.cleanup_error`. Raw DB/tool errors are not logged.

## Restore drill (isolated, never production)

1. Choose a disposable PG17 host/stack with **no serving API/intake**. Do not use
   the production DB service. Create an empty database named `restore-drill`
   using operator credentials. Keep its own pgpass entry. The script does not
   create targets and requires restore-*; PRODUCTION_DB_NAME must be explicit.
   Exact FORCE_RESTORE_TO allowlisting cannot bypass the restore-* rule.
2. Transfer only an encrypted backup to the drill host. Make the operator's
   identity available temporarily via a read-only secret mount outside backups
   (mode0600, UID10001 readable). Do not copy it into the image or evidence.
3. Run the image's maintenance script against the isolated host (replace
   placeholder host/image/paths; use an isolated Docker network reachable by
   the drill DB, not production):

```bash
docker run --rm --network <isolated-drill-network> \
  -v "$PWD/deploy/maintenance:/opt/maintenance:ro" \
  -v "$PWD/deploy/backups-test:/backups" \
  -v /operator/secret/identity:/run/secrets/age-identity:ro \
  -v /operator/secret/drill-pgpass:/run/secrets/pgpass:ro \
  -e PGHOST=<drill-db-host> -e PGPORT=5432 -e PGUSER=<drill-user> \
  -e PGPASSFILE=/run/secrets/pgpass -e TARGET_DB=restore-drill \
  -e PRODUCTION_DB_NAME=ochakovo_candidates \
  -e BACKUP_AGE_KEY_FILE=/run/secrets/age-identity \
  192.168.1.47:7002/ochakovo-candidates-api:<verified-tag> \
  bash /opt/maintenance/restore.sh /backups/<UTC-stamp>.dump.age
```

4. Script decrypts to temporary file; pg_restore 17 uses --clean --if-exists,
   single transaction, fail-fast; plaintext removed immediately and on failure.
   Run the printed count/version queries; compare to backup-time synthetic
   baseline on all relevant tables, confirm FK/check constraints and migration
   head. No claim of verified restore until this drill actually passes (T11-B).
5. Set DATABASE_URL **only to the disposable target** and run
   `python -m app.cli cleanup`. Reconcile audit history after the backup and
   replay every administrator deletion (do not resurrect deleted applicants).
   Verify retention expiry and idempotency/session cleanup. Restored backups
   can contain an enabled privacy flag and old sessions: keep network serving
   disabled; never auto-resume intake. Re-enable only by separately authorized
   activation after reconciliation and external/privacy gates.
6. Unmount identity, remove disposable drill stack/volume only after confirming
   its exact test identity; retain redacted count/constraint evidence only.

Rollback is a different operation: select previous compatible image tag without
deleting volumes. Never production `down -v`, never restore into live serving DB.
These are local backups, not off-host disaster recovery. Owner should arrange
encrypted off-host copies and independent recovery documentation/access.
