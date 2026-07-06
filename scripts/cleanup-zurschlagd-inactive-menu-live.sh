#!/usr/bin/env bash
# Live-DB: inaktive Speisekarten-Gerichte für zurschlagd löschen + Nummerierung pro Kategorie.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
  esac
done

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
  echo "SSH zum Live-VPS fehlgeschlagen (${LIVE_VPS_HOST})." >&2
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
DB_URL="postgresql://postgres@127.0.0.1:${LIVE_TUNNEL_LOCAL_PORT}/postgres?sslmode=disable"

echo ""
echo "=== zurschlagd: inaktive menu_items (Vorschau) ==="
psql "${DB_URL}" -v ON_ERROR_STOP=1 -c "
SELECT
  count(*) FILTER (WHERE mi.is_active = false) AS inactive_items,
  count(*) FILTER (WHERE mi.is_active = true) AS active_items,
  min(mi.list_number) FILTER (WHERE mi.is_active = true) AS active_min_list_number,
  max(mi.list_number) FILTER (WHERE mi.is_active = true) AS active_max_list_number
FROM public.menu_items mi
JOIN public.restaurants r ON r.id = mi.restaurant_id
WHERE r.slug = 'zurschlagd';
"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo ""
  echo "Dry-run — keine Änderungen."
  exit 0
fi

echo ""
echo "=== zurschlagd: Cleanup ausführen ==="
psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${ROOT}/scripts/cleanup-zurschlagd-inactive-menu-live.sql"

echo ""
echo "Fertig."
