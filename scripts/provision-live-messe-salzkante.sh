#!/usr/bin/env bash
# Live: Messe-Demo „Die Salzkante“ + Owner messe@gwada.de provisionieren.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LIVE_APP_ORIGIN="${LIVE_APP_ORIGIN:-https://gwada.app}"

if [[ -f .env.production ]]; then
  set -a
  while IFS= read -r line; do
    case "$line" in
      LIVE_TUNNEL_REMOTE_HOST=*|LIVE_VPS_HOST=*|LIVE_SSH_USER=*|LIVE_TUNNEL_LOCAL_PORT=*|LIVE_TUNNEL_REMOTE_PORT=*|SUPABASE_DB_URL=*|NEXT_PUBLIC_SUPABASE_URL=*|SUPABASE_SERVICE_ROLE_KEY=*)
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

if [[ -z "${LIVE_VPS_HOST:-}" ]]; then
  echo "LIVE_VPS_HOST fehlt (Umgebung oder .env.production)." >&2
  exit 1
fi

if ! gwada_ssh_cmd -o ConnectTimeout=8 "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zu Live fehlgeschlagen — LIVE_SSH_KEY / Identity prüfen." >&2
  exit 1
fi

export GWADA_SSH_IDENTITY="${GWADA_SSH_IDENTITY:-${HOME}/.ssh/gwada_vps_ed25519}"
bash "${ROOT}/scripts/provision-live-messe-salzkante-ci.sh"

echo ""
echo "Öffentlich: ${LIVE_APP_ORIGIN}/salzkante"
echo "Login: messe@gwada.de / Salzkante-Messe-2026!Gwada"
