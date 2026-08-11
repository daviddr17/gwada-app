#!/usr/bin/env bash
# Live: Meta App Review Demo (ohne WhatsApp/WAHA) provisionieren.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIVE_APP_ORIGIN="${LIVE_APP_ORIGIN:-https://gwada.app}"
META_EMAIL="${META_REVIEW_EMAIL:-meta-review@gwada.app}"

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

echo "=== Live-DB: Gwada Meta Review Demo provisionieren ==="
npx dotenv -e .env.production -- bash -c '
  DB_URL="${SUPABASE_DB_URL}"
  if [[ "${DB_URL}" != *sslmode=* ]]; then
    if [[ "${DB_URL}" == *"?"* ]]; then DB_URL="${DB_URL}&sslmode=disable"; else DB_URL="${DB_URL}?sslmode=disable"; fi
  fi
  psql "${DB_URL}" -v ON_ERROR_STOP=1 -f scripts/provision-live-meta-review.sql
'

echo ""
echo "Fertig."
echo "  URL:      ${LIVE_APP_ORIGIN}"
echo "  Email:    ${META_EMAIL}"
echo "  Password: MetaReview-Gwada-2026!"
echo "  Restaurant slug: gwada-meta-review-demo"
echo "  WhatsApp: nicht verbunden + UI-Hide nach Deploy des Meta-Review-Flags"
