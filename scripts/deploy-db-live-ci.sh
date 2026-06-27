#!/usr/bin/env bash
# CI / GitHub Actions: SSH-Tunnel + supabase db push (ohne .env.production auf dem Runner).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

export SUPABASE_DB_URL="postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:${LIVE_TUNNEL_LOCAL_PORT}/postgres"
export PGSSLMODE=disable

SUPABASE_CMD="supabase"
if ! command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD="npx supabase"
fi

repair_migration_applied() {
  local version="$1"
  if ${SUPABASE_CMD} migration list --db-url "${SUPABASE_DB_URL}" 2>/dev/null \
    | grep -E "${version}.*Applied"; then
    return 0
  fi
  echo "Repair ${version} → applied (Schema bereits auf Live)"
  ${SUPABASE_CMD} migration repair --status applied --db-url "${SUPABASE_DB_URL}" "${version}"
}

echo ""
echo "=== Live-DB: Migration-History (Drift-Reparatur) ==="
# Live hat oft Schema unter anderen Versions-IDs; History nachziehen bis 20260626100000.
LIVE_SCHEMA_DRIFT_VERSIONS=(
  20260613170000
  20260619120500
  20260620170000
  20260620175000
  20260621150100
  20260624290000
  20260624300000
)
for version in "${LIVE_SCHEMA_DRIFT_VERSIONS[@]}"; do
  repair_migration_applied "${version}" || true
done

echo ""
echo "=== Live-DB: Migrationen anwenden (nur Schema) ==="
bash scripts/db-push-live.sh --yes --include-all "$@"

echo ""
echo "Live-DB-Migrationen angewendet."
