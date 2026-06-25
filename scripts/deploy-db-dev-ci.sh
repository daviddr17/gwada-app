#!/usr/bin/env bash
# CI: SSH-Tunnel + supabase db push gegen Dev-DB (gleicher Weg wie Live, kein psql Multi-Pass).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_COMPOSE_DIR="${DEV_COMPOSE_DIR:-/opt/gwada-supabase-dev}"

# tunnel-live-lib.sh nutzt LIVE_* — Dev-Stack hat eigenen Container/Port
export LIVE_VPS_HOST="${DEV_VPS_HOST}"
export LIVE_SSH_USER="${DEV_SSH_USER}"
export LIVE_TUNNEL_LOCAL_PORT="${DEV_TUNNEL_LOCAL_PORT:-5436}"
export LIVE_TUNNEL_REMOTE_PORT=5432
export LIVE_DB_CONTAINER_GREP="${DEV_DB_CONTAINER_GREP:-gwada-dev-db}"

# shellcheck source=scripts/tunnel-live-lib.sh
source "${ROOT}/scripts/tunnel-live-lib.sh"

cleanup() {
  gwada_tunnel_stop
}
trap cleanup EXIT INT TERM

if ! command -v supabase >/dev/null 2>&1 && ! npx supabase --version >/dev/null 2>&1; then
  echo "Supabase CLI fehlt." >&2
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
  echo "Dev-DB-Container (${LIVE_DB_CONTAINER_GREP}) nicht gefunden." >&2
  exit 1
fi

POSTGRES_PASSWORD="$(
  gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" \
    "docker exec ${DB_CONTAINER} printenv POSTGRES_PASSWORD"
)"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD//$'\r'/}"
if [[ -z "${POSTGRES_PASSWORD}" ]]; then
  echo "POSTGRES_PASSWORD im Dev-Container leer." >&2
  exit 1
fi

ENC_PW="$(
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${POSTGRES_PASSWORD}"
)"

export SUPABASE_DB_URL="postgresql://postgres:${ENC_PW}@127.0.0.1:${LIVE_TUNNEL_LOCAL_PORT}/postgres?sslmode=disable"
export PGSSLMODE=disable

echo ""
echo "=== Dev-DB: Migrationen anwenden (supabase db push) ==="
bash scripts/db-push-live.sh --yes --include-all "$@"

echo ""
echo "→ Auth/REST neu laden (GoTrue-Schema nach Migrationen) …"
gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" bash <<REMOTE
set -euo pipefail
cd "${DEV_COMPOSE_DIR}"
export COMPOSE_PROJECT_NAME=gwada-dev
docker compose exec -T db psql -U postgres -c "NOTIFY pgrst, 'reload schema';" 2>/dev/null || true
docker compose up -d --force-recreate auth rest 2>/dev/null || docker compose restart auth rest
REMOTE

echo ""
echo "Dev-DB-Migrationen angewendet."
