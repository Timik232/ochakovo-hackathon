#!/usr/bin/env bash
# Silent success. Failures are actionable and leave metadata-only markers.
set -euo pipefail
umask 077
BACKUP_DIR=${BACKUP_DIR:-/backups}
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.backup.lock"
flock -n 9 || exit 0
stamp=$(date -u +%Y%m%d-%H%M%S)
name="$stamp.dump.age"
plain=''
encrypted=''
finish() {
    status=$?
    [[ -z "$plain" ]] || rm -f -- "$plain"
    [[ -z "$encrypted" ]] || rm -f -- "$encrypted"
    if (( status != 0 )); then
        printf '%s %s\n' "$(date -u +%FT%TZ)" "$name" > "$BACKUP_DIR/.last_error"
        printf 'Backup failed; inspect maintenance configuration and metadata marker.\n' >&2
    fi
}
trap finish EXIT
trap 'exit 1' HUP INT TERM
[[ ${BACKUP_RETENTION_DAYS:-14} =~ ^[1-9][0-9]*$ ]]
: "${BACKUP_AGE_RECIPIENT:?Public age recipient required}"
: "${PGDATABASE:?Database required}" "${PGUSER:?Database user required}"
: "${PGPASSFILE:?Mounted mode-0600 pgpass file required}"
[[ -r "$PGPASSFILE" && $(stat -c %a "$PGPASSFILE") == 600 ]]
unset PGPASSWORD
plain=$(mktemp /tmp/ochakovo-dump.XXXXXX)
encrypted=$(mktemp "$BACKUP_DIR/.encrypted.XXXXXX")
# Tools may include private object names in errors: never relay raw stderr.
pg_dump --no-password --format=custom --file="$plain" 2>/dev/null
age -r "$BACKUP_AGE_RECIPIENT" -o "$encrypted" "$plain" 2>/dev/null
rm -f -- "$plain"
plain=''
mv -- "$encrypted" "$BACKUP_DIR/$name"
encrypted=''
find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.dump.age' -mtime "+${BACKUP_RETENTION_DAYS:-14}" -delete
printf '%s %s\n' "$(date -u +%FT%TZ)" "$name" > "$BACKUP_DIR/.last_success"
rm -f -- "$BACKUP_DIR/.last_error"
