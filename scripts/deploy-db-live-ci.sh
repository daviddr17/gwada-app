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

DB_URL="${SUPABASE_DB_URL}?sslmode=disable"

echo ""
echo "=== Live-DB: Migration history repair (falls nötig) ==="
# Galerie 20260623120000: Datei nach erstem Live-Versuch angepasst — als applied markieren.
supabase migration repair --status applied --db-url "${DB_URL}" --yes 20260623120000 2>/dev/null || true

echo ""
echo "=== Live-DB: Migrationen anwenden (nur Schema) ==="
# Kein --include-all: sonst werden geänderte, bereits registrierte Migrationen erneut ausgeführt.
bash scripts/db-push-live.sh --yes "$@"

echo ""
echo "Live-DB-Migrationen angewendet."
