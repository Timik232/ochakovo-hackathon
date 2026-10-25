#!/usr/bin/env bash
set -euo pipefail
umask 077
if [[ ${1:-} == --list ]]; then
    find "${BACKUP_DIR:-/backups}" -maxdepth 1 -type f -name '*.dump.age' -printf '%f\n' | sort
    exit 0
fi
: "${TARGET_DB:?Set disposable restore-* target database}"
# Neither an explicit allowlist nor a production override permits non-restore targets.
[[ "$TARGET_DB" =~ ^restore-[a-zA-Z0-9_-]+$ ]] || { printf 'Refusing non-restore-* database\n' >&2; exit 1; }
: "${PRODUCTION_DB_NAME:?Set protected production database name}"
if [[ "$TARGET_DB" == "$PRODUCTION_DB_NAME" && ${FORCE_RESTORE_TO:-} != "$TARGET_DB" ]]; then
    printf 'Refusing production target without exact FORCE_RESTORE_TO allowlist\n' >&2
    exit 1
fi
: "${PGPASSFILE:?Mounted pgpass required}" "${BACKUP_AGE_KEY_FILE:?Operator identity mount required}"
[[ -r "$PGPASSFILE" && $(stat -c %a "$PGPASSFILE") == 600 ]]
archive=${1:?Usage: restore.sh /backups/YYYYMMDD-HHMMSS.dump.age}
[[ -f "$archive" && "$archive" == *.dump.age ]]
export PGDATABASE="$TARGET_DB"
unset PGPASSWORD DATABASE_URL
exec 9>"${BACKUP_DIR:-/backups}/.restore.lock"
flock -n 9 || { printf 'Another restore is running\n' >&2; exit 1; }
plain=$(mktemp /tmp/ochakovo-restore.XXXXXX)
trap 'rm -f -- "$plain"' EXIT
trap 'exit 1' HUP INT TERM
age -d -i "$BACKUP_AGE_KEY_FILE" -o "$plain" "$archive" 2>/dev/null || { printf 'Decryption failed\n' >&2; exit 1; }
# Target must already exist on the isolated drill DB host; never create it implicitly.
pg_restore --no-password --exit-on-error --single-transaction --clean --if-exists --no-owner --no-acl --dbname="$TARGET_DB" "$plain" 2>/dev/null || { printf 'Restore failed; disposable target remains offline\n' >&2; exit 1; }
rm -f -- "$plain"
printf '%s\n' 'Restore completed OFFLINE. Run these count checks against the target:'
printf '%s\n' 'SELECT count(*) FROM candidates;' 'SELECT count(*) FROM employees;' 'SELECT count(*) FROM candidate_comments;' 'SELECT count(*) FROM audit_events;' 'SELECT count(*) FROM sessions;' 'SELECT count(*) FROM public_submissions;' 'SELECT count(*) FROM vacancies;' 'SELECT version_num FROM alembic_version;'
printf '%s\n' 'WARNING: run python -m app.cli cleanup with DATABASE_URL pointing ONLY to this target.' 'Reconcile audit log and replay all admin deletions since backup BEFORE serving.' 'Intake is NOT resumed automatically; keep restored stack offline until review.'
