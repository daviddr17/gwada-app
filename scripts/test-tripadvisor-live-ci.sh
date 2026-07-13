#!/usr/bin/env bash
# CI: TripAdvisor Terra API gegen Live-DB (zurschlagd) testen.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/tunnel-live-lib.sh
source "${ROOT}/scripts/tunnel-live-lib.sh"

LOCATION_ID="${GWADA_TRIPADVISOR_LOCATION_ID:-12950592}"
SLUG="${GWADA_RESTAURANT_SLUG:-zurschlagd}"

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
DB_URL="postgresql://postgres@${LIVE_TUNNEL_LOCAL_HOST:-127.0.0.1}:${LIVE_TUNNEL_LOCAL_PORT}/postgres"

read -r ENABLED API_KEY RESTAURANT_ID DB_LOCATION STATUS LAST_ERROR <<<"$(
  psql "${DB_URL}" -t -A -F $'\t' <<SQL
select
  coalesce((select enabled::text from platform_integrations where key = 'tripadvisor'), 'false'),
  coalesce((select config->>'api_key' from platform_integrations where key = 'tripadvisor'), ''),
  coalesce((select id::text from restaurants where slug = '${SLUG}' limit 1), ''),
  coalesce((select config->>'location_id' from restaurant_integrations ri join restaurants r on r.id = ri.restaurant_id where r.slug = '${SLUG}' and ri.integration_key = 'tripadvisor' limit 1), ''),
  coalesce((select status from restaurant_integrations ri join restaurants r on r.id = ri.restaurant_id where r.slug = '${SLUG}' and ri.integration_key = 'tripadvisor' limit 1), ''),
  coalesce((select last_error from restaurant_integrations ri join restaurants r on r.id = ri.restaurant_id where r.slug = '${SLUG}' and ri.integration_key = 'tripadvisor' limit 1), '');
SQL
)"

echo "=== Live TripAdvisor Diagnose (${SLUG}) ==="
echo "platform_enabled=${ENABLED}"
echo "api_key_len=${#API_KEY}"
echo "restaurant_id=${RESTAURANT_ID}"
echo "db_location_id=${DB_LOCATION:-<leer>}"
echo "integration_status=${STATUS:-<keine>}"
echo "last_error=${LAST_ERROR:-<keine>}"

if [[ "${ENABLED}" != "t" && "${ENABLED}" != "true" ]]; then
  echo "::error::TripAdvisor in platform_integrations nicht enabled"
  exit 1
fi
if [[ -z "${API_KEY}" ]]; then
  echo "::error::TripAdvisor API-Key fehlt in platform_integrations.config"
  exit 1
fi

TEST_LOCATION="${DB_LOCATION:-$LOCATION_ID}"
echo "test_location_id=${TEST_LOCATION}"

terra_get() {
  local path="$1"
  curl -sS -w "\nHTTP:%{http_code}" \
    -H "Accept: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    "https://terra.tripadvisor.com/api${path}"
}

echo ""
echo "--- GET /allowlist?version=1 ---"
ALLOW_GET="$(terra_get "/allowlist?version=1")"
echo "${ALLOW_GET}" | sed '$d' | head -c 400
echo ""
echo "${ALLOW_GET}" | tail -1

echo ""
echo "--- POST /allowlist (APPEND, Terra-Schema) ---"
ALLOW_POST_CODE="$(
  curl -sS -o /tmp/ta-allow-post.json -w "%{http_code}" \
    -X POST "https://terra.tripadvisor.com/api/allowlist?version=1" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d "{\"operation_type\":\"APPEND\",\"allowlist\":[${TEST_LOCATION}]}"
)"
echo "HTTP:${ALLOW_POST_CODE}"
head -c 400 /tmp/ta-allow-post.json || true
echo ""

echo ""
echo "--- GET /locations/${TEST_LOCATION}?version=1&locale=de-DE ---"
LOC_GET="$(terra_get "/locations/${TEST_LOCATION}?version=1&locale=de-DE")"
echo "${LOC_GET}" | sed '$d' | head -c 500
echo ""
LOC_CODE="$(echo "${LOC_GET}" | tail -1 | sed 's/HTTP://')"
echo "${LOC_GET}" | tail -1

echo ""
echo "--- GET /catalog/locations/${TEST_LOCATION}?version=1 ---"
CAT_GET="$(terra_get "/catalog/locations/${TEST_LOCATION}?version=1")"
echo "${CAT_GET}" | sed '$d' | head -c 500
echo ""
CAT_CODE="$(echo "${CAT_GET}" | tail -1 | sed 's/HTTP://')"
echo "${CAT_GET}" | tail -1

echo ""
echo "--- GET /locations/${TEST_LOCATION}/reviews?version=1&language=de&page=1&size=5 ---"
REV_GET="$(terra_get "/locations/${TEST_LOCATION}/reviews?version=1&language=de&page=1&size=5")"
echo "${REV_GET}" | sed '$d' | head -c 400
echo ""
echo "${REV_GET}" | tail -1

if [[ "${ALLOW_POST_CODE}" != "200" && "${LOC_CODE}" != "200" && "${CAT_CODE}" != "200" ]]; then
  echo "::error::Alle Terra-Tests fehlgeschlagen (allowlist=${ALLOW_POST_CODE}, location=${LOC_CODE}, catalog=${CAT_CODE})"
  exit 1
fi

echo ""
echo "OK: mindestens ein Terra-Endpoint antwortete erfolgreich."
