#!/usr/bin/env bash
# CI: SQL gegen Dev-Supabase-DB auf dem VPS (/opt/gwada-supabase-dev) via docker exec.
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

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_COMPOSE_DIR="${DEV_COMPOSE_DIR:-/opt/gwada-supabase-dev}"

: "${GWADA_SSH_IDENTITY:=${HOME}/.ssh/id_ed25519}"
GWADA_SSH_OPTS=(
  -o ConnectTimeout=15
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=120
)
if [[ -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH_OPTS+=(-i "${GWADA_SSH_IDENTITY}")
fi

gwada_ssh_cmd() {
  ssh "${GWADA_SSH_OPTS[@]}" -o LogLevel=ERROR "$@"
}

if ! gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zum VPS fehlgeschlagen." >&2
  exit 1
fi

REMOTE_SQL="/tmp/gwada-dev-sql-$(basename "${SQL_FILE}")"
scp "${GWADA_SSH_OPTS[@]}" "${SQL_FILE}" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}:${REMOTE_SQL}"

echo "=== Dev SQL: ${SQL_FILE} ==="
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "DEV_COMPOSE_DIR=$(printf '%q' "${DEV_COMPOSE_DIR}") REMOTE_SQL=$(printf '%q' "${REMOTE_SQL}") bash -s" <<'REMOTE'
set -euo pipefail
cd "${DEV_COMPOSE_DIR}"
export COMPOSE_PROJECT_NAME=gwada-dev
if ! docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
  echo "Dev-DB nicht bereit." >&2
  exit 1
fi
docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < "${REMOTE_SQL}"
rm -f "${REMOTE_SQL}"
REMOTE
echo "=== Fertig ==="
