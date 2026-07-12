#!/usr/bin/env bash
# CI: SSH-Tunnel + psql gegen Live-DB (ein SQL-File).
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <sql-file>" >&2
  exit 1
fi

SQL_FILE="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "SQL-Datei nicht gefunden: ${SQL_FILE}" >&2
  exit 1
fi

# shellcheck source=scripts/tunnel-live-lib.sh
source "${ROOT}/scripts/tunnel-live-lib.sh"

cleanup() {
  gwada_tunnel_stop
}
trap cleanup EXIT INT TERM

if ! command -v psql >/dev/null 2>&1; then
  echo "psql fehlt." >&2
  exit 1
fi

if ! gwada_ssh_cmd -o ConnectTimeout=8 "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zum VPS fehlgeschlagen." >&2
  exit 1
fi

gwada_tunnel_start_bg

DB_CONTAINER="$(
  gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" \
    "docker ps --format '{{.Names}}' | grep '${LIVE_DB_CONTAINER_GREP}' | head -1"
)"
DB_CONTAINER="${DB_CONTAINER//$'\r'/}"
if [[ -z "${DB_CONTAINER}" ]]; then
  echo "Supabase-DB-Container nicht gefunden." >&2
  exit 1
fi

POSTGRES_PASSWORD="$(
  gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" \
    "docker exec ${DB_CONTAINER} printenv POSTGRES_PASSWORD"
)"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD//$'\r'/}"
if [[ -z "${POSTGRES_PASSWORD}" ]]; then
  echo "POSTGRES_PASSWORD im Container leer." >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD}"
export PGSSLMODE=disable

echo "=== Live SQL: ${SQL_FILE} ==="
psql -h 127.0.0.1 -p "${LIVE_TUNNEL_LOCAL_PORT}" -U postgres -d postgres -v ON_ERROR_STOP=1 -f "${SQL_FILE}"
echo "=== Fertig ==="
