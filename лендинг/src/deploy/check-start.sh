#!/usr/bin/env bash
# Read-only capacity gate; never stop neighboring services to make room.
set -euo pipefail
available_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
disk_kib=$(df -Pk "$(dirname "$0")" | awk 'NR==2 {print $4}')
printf 'Available RAM: %s KiB (minimum 2097152); disk: %s KiB (minimum 5242880)\n' "$available_kib" "$disk_kib"
if (( available_kib < 2097152 || disk_kib < 5242880 )); then
    printf 'BLOCKED: insufficient capacity; do not stop other services.\n' >&2
    exit 1
fi
