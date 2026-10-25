#!/usr/bin/env bash
set -euo pipefail

# Run the authoritative Jenkins test gate for the current repository snapshot.
# Usage: scripts/jenkins/run-test-gate.sh [TAG]
# TAG labels the evidence file; omit it to write gate-latest.txt.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TAG="${1:-latest}"
JENKINS_URL="${JENKINS_URL:-http://192.168.1.37:18080}"
DROP_ZONE="${JENKINS_DROP_ZONE:-/DATA/AppData/jenkins/home/builds/incoming}"
SSH_KEY="${JENKINS_SSH_KEY:-$HOME/.ssh/id_ed25519}"
EVIDENCE_DIR="/DATA/AppData/.sisyphus/evidence/ochakovo"
ARCHIVE="/tmp/opencode/ochakovo-gate-${TAG}-$$.tar.gz"
COOKIE_JAR="/tmp/opencode/ochakovo-gate-${TAG}-$$.cookies"
TOKEN_FILE="/tmp/opencode/ochakovo-gate-token-$$"
REMOTE_ARCHIVE="${DROP_ZONE}/$(basename "$ARCHIVE")"

cleanup() { rm -f "$ARCHIVE" "$COOKIE_JAR" "$TOKEN_FILE"; }
trap cleanup EXIT
mkdir -p "$EVIDENCE_DIR"

tar czf "$ARCHIVE" \
  --exclude='*/node_modules*' --exclude='*/.venv*' --exclude='*/dist*' \
  --exclude='*/__pycache__*' --exclude='*/backups*' --exclude='.env*' \
  --exclude='*/secrets*' --exclude='*/junit*' --exclude='*/evidence*' \
  --exclude='*/test-results*' --exclude='*/playwright-report*' \
  --exclude='*/.sisyphus*' -C "$ROOT" .
scp -i "$SSH_KEY" "$ARCHIVE" "timur@192.168.1.37:${REMOTE_ARCHIVE}"

TOKEN="$(curl -fsS -H "X-Vault-Token: $(< /DATA/AppData/vault/.root-token)" \
  http://127.0.0.1:8200/v1/secret/data/apps/jenkins | \
  python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["data"]["api_token"])')"
printf '%s' "$TOKEN" > "$TOKEN_FILE"
AUTH="svc-opencode:$(< "$TOKEN_FILE")"
CRUMB_JSON="$(curl -fsS -c "$COOKIE_JAR" -u "$AUTH" "$JENKINS_URL/crumbIssuer/api/json")"
CRUMB_FIELD="$(python3 -c 'import json,sys;print(json.load(sys.stdin)["crumbRequestField"])' <<< "$CRUMB_JSON")"
CRUMB="$(python3 -c 'import json,sys;print(json.load(sys.stdin)["crumb"])' <<< "$CRUMB_JSON")"
PREVIOUS="$(curl -g -fsS -u "$AUTH" "$JENKINS_URL/job/ochakovo-candidates-tests/api/json?tree=lastBuild[number]" | python3 -c 'import json,sys; print((json.load(sys.stdin).get("lastBuild") or {}).get("number",0))')"
HTTP="$(curl -sS -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" -u "$AUTH" \
  -H "$CRUMB_FIELD: $CRUMB" -X POST "$JENKINS_URL/job/ochakovo-candidates-tests/buildWithParameters" \
  --data-urlencode "LOCAL_PATH=/var/jenkins_home/builds/incoming/$(basename "$ARCHIVE")")"
[[ "$HTTP" == 201 ]] || { printf 'Jenkins trigger returned HTTP %s\n' "$HTTP" >&2; exit 1; }

EXPECTED=0
for _ in $(seq 1 360); do
  BUILD_JSON="$(curl -g -sS -f -u "$AUTH" "$JENKINS_URL/job/ochakovo-candidates-tests/lastBuild/api/json?tree=number,building,result" 2>/dev/null || true)"
  if [[ -z "$BUILD_JSON" ]]; then sleep 10; continue; fi
  read -r NUMBER BUILDING RESULT < <(python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["number"],str(d["building"]).lower(),d.get("result") or "")' <<< "$BUILD_JSON")
  if (( NUMBER > PREVIOUS )); then EXPECTED="$NUMBER"; fi
  if (( EXPECTED > 0 && NUMBER >= EXPECTED )) && [[ "$BUILDING" == false ]]; then break; fi
  sleep 10
done
[[ "$EXPECTED" -gt 0 && "$BUILDING" == false ]] || { echo 'Timed out waiting for Jenkins build' >&2; exit 124; }
CONSOLE="$(curl -fsS -u "$AUTH" "$JENKINS_URL/job/ochakovo-candidates-tests/$EXPECTED/consoleText")"
printf '%s\n' "$CONSOLE" > "$EVIDENCE_DIR/gate-${TAG}.txt"
printf 'Build #%s result: %s\n' "$EXPECTED" "$RESULT"
[[ "$RESULT" == SUCCESS ]]
