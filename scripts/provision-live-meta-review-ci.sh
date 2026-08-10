#!/usr/bin/env bash
# CI: Meta App Review Demo auf Live (ohne WhatsApp/WAHA).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIVE_APP_ORIGIN="${LIVE_APP_ORIGIN:-https://gwada.app}"
META_EMAIL="${META_REVIEW_EMAIL:-meta-review@gwada.app}"

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

DB_URL="postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:${LIVE_TUNNEL_LOCAL_PORT}/postgres?sslmode=disable"
export PGSSLMODE=disable

echo ""
echo "=== Live-DB: Gwada Meta Review Demo provisionieren ==="
psql "${DB_URL}" -v ON_ERROR_STOP=1 -f scripts/provision-live-meta-review.sql

echo ""
echo "Fertig: ${META_EMAIL} → gwada-meta-review-demo"
echo "Login: Passwort siehe scripts/provision-live-meta-review.sql (MetaReview-Gwada-2026!)"
echo "App: ${LIVE_APP_ORIGIN}"
