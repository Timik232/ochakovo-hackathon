#!/usr/bin/env bash
set -euo pipefail
umask 077
export TZ=UTC
BACKUP_DIR=${BACKUP_DIR:-/backups}
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
exec 8>"$BACKUP_DIR/.maintenance.lock"
flock -n 8 || exit 0
trap 'exit 0' TERM INT
retry_once() {
    "$@" >/dev/null 2>&1 && return 0
    sleep 60
    "$@" >/dev/null 2>&1
}
while true; do
    if ! retry_once bash /opt/maintenance/backup.sh; then
        # Log once per daily cycle, not on every retry. Never log command output.
        printf 'Daily encrypted backup failed; see .last_error\n' >&2
    fi
    if retry_once python -m app.cli cleanup; then
        printf '%s cleanup\n' "$(date -u +%FT%TZ)" > "$BACKUP_DIR/.cleanup_success"
        rm -f "$BACKUP_DIR/.cleanup_error"
    else
        printf '%s cleanup\n' "$(date -u +%FT%TZ)" > "$BACKUP_DIR/.cleanup_error"
        printf 'Daily cleanup failed; see .cleanup_error\n' >&2
    fi
    # First cycle on startup; subsequent cycles at 00:00 UTC (not local DST).
    sleep "$(( $(date -u -d 'tomorrow 00:00' +%s) - $(date -u +%s) ))" &
    wait $!
done
