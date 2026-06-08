#!/usr/bin/env bash
# Live: Fadis BurgerStation + Fadi Hanna anlegen und Magic-Link senden.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIVE_APP_ORIGIN="${LIVE_APP_ORIGIN:-https://new.gwada.app}"
FADI_EMAIL="${FADI_EMAIL:-fadih32@gmail.com}"

if [[ -f .env.production ]]; then
  set -a
  while IFS= read -r line; do
    case "$line" in
      LIVE_TUNNEL_REMOTE_HOST=*|LIVE_VPS_HOST=*|LIVE_SSH_USER=*|LIVE_TUNNEL_LOCAL_PORT=*|LIVE_TUNNEL_REMOTE_PORT=*|SUPABASE_DB_URL=*)
        [[ "$line" =~ ^# ]] && continue
        export "$line"
        ;;
    esac
  done < .env.production
  set +a
fi

# shellcheck source=scripts/tunnel-live-lib.sh
source "${ROOT}/scripts/tunnel-live-lib.sh"

cleanup() {
  gwada_tunnel_stop
}
trap cleanup EXIT INT TERM

if ! grep -q '^SUPABASE_DB_URL=' .env.production 2>/dev/null; then
  echo "SUPABASE_DB_URL fehlt in .env.production" >&2
  exit 1
fi

if ! gwada_ssh_cmd -o ConnectTimeout=8 "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zu Live fehlgeschlagen — ssh-copy-id ${LIVE_SSH_USER}@${LIVE_VPS_HOST}" >&2
  exit 1
fi

gwada_tunnel_start_bg

echo "=== Live-DB: Fadis BurgerStation provisionieren ==="
npx dotenv -e .env.production -- bash -c '
  DB_URL="${SUPABASE_DB_URL}"
  if [[ "${DB_URL}" != *sslmode=* ]]; then
    if [[ "${DB_URL}" == *"?"* ]]; then DB_URL="${DB_URL}&sslmode=disable"; else DB_URL="${DB_URL}?sslmode=disable"; fi
  fi
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -f scripts/provision-live-fadis-burgerstation.sql
'

echo ""
echo "=== Magic-Link an ${FADI_EMAIL} senden ==="
HTTP_CODE="$(curl -sS -o /tmp/gwada-magic-link-response.json -w "%{http_code}" \
  -X POST "${LIVE_APP_ORIGIN}/api/auth/magic-link" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${FADI_EMAIL}\",\"next\":\"/dashboard\"}")"

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "Magic-Link fehlgeschlagen (HTTP ${HTTP_CODE}):" >&2
  cat /tmp/gwada-magic-link-response.json >&2
  exit 1
fi

echo "Magic-Link gesendet."
cat /tmp/gwada-magic-link-response.json
echo ""
echo "Fertig: ${FADI_EMAIL} → Fadis BurgerStation (slug: fadis-burgerstation)"
