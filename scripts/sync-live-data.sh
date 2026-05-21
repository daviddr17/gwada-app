#!/usr/bin/env bash
# Einmalig: nur Daten lokal → Live (ohne Migrationen). Tunnel wird bei Bedarf gestartet.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.production ]]; then
  set -a
  while IFS= read -r line; do
    case "$line" in
      LIVE_TUNNEL_REMOTE_HOST=*|LIVE_VPS_HOST=*|LIVE_SSH_USER=*|LIVE_TUNNEL_LOCAL_PORT=*|LIVE_TUNNEL_REMOTE_PORT=*)
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

if ! gwada_ssh_cmd -o ConnectTimeout=8 "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" true 2>/dev/null; then
  echo "SSH ohne Key fehlgeschlagen. Einmalig: ssh-copy-id ${LIVE_SSH_USER}@${LIVE_VPS_HOST}" >&2
  exit 1
fi

gwada_tunnel_start_bg

echo "=== Daten: lokal → Live (public${SYNC_INCLUDE_AUTH:+ + auth}) ==="
dotenv -e .env.production -- bash "${ROOT}/scripts/live-sync-data.sh"
echo "=== Fertig ==="
