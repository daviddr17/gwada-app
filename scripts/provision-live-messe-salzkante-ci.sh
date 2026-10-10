#!/usr/bin/env bash
# CI: Messe-Demo „Die Salzkante“ auf Live provisionieren + Medien hochladen.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIVE_APP_ORIGIN="${LIVE_APP_ORIGIN:-https://gwada.app}"
MESSE_EMAIL="${MESSE_EMAIL:-messe@gwada.de}"
COOLIFY_APP_ID="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
COMPOSE_ENV="/data/coolify/applications/${COOLIFY_APP_ID}/.env"

# shellcheck source=scripts/tunnel-live-lib.sh
source "${ROOT}/scripts/tunnel-live-lib.sh"

cleanup() {
  gwada_tunnel_stop
}
trap cleanup EXIT INT TERM

if ! gwada_ssh_cmd -o ConnectTimeout=8 "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zum VPS fehlgeschlagen." >&2
  exit 1
fi

read_vps_env_key() {
  local key="$1"
  gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" \
    "grep -E '^${key}=' '${COMPOSE_ENV}' 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"'" \
    || true
}

gwada_tunnel_start_bg

DB_CONTAINER="$(gwada_resolve_app_db_container | tail -1)"
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

DB_URL="postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:${LIVE_TUNNEL_LOCAL_PORT}/postgres?sslmode=disable"
export PGSSLMODE=disable

echo ""
echo "=== Live-DB: Die Salzkante (Messe-Demo) provisionieren ==="
psql "${DB_URL}" -v ON_ERROR_STOP=1 -f scripts/provision-live-messe-salzkante.sql

echo ""
echo "=== Medien hochladen ==="
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-$(read_vps_env_key NEXT_PUBLIC_SUPABASE_URL)}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$(read_vps_env_key SUPABASE_SERVICE_ROLE_KEY)}"
if [[ -z "${NEXT_PUBLIC_SUPABASE_URL}" || -z "${SUPABASE_SERVICE_ROLE_KEY}" ]]; then
  echo "NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt (VPS ${COMPOSE_ENV})." >&2
  exit 1
fi

node scripts/provision-live-messe-salzkante-upload-media.mjs

echo ""
echo "Fertig: ${MESSE_EMAIL} → salzkante"
echo "App: ${LIVE_APP_ORIGIN}"
echo "Public: ${LIVE_APP_ORIGIN}/salzkante"
echo "Login: Passwort siehe scripts/provision-live-messe-salzkante.sql (Salzkante-Messe-2026!Gwada)"
