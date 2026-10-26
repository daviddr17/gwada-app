#!/usr/bin/env bash
# Stoppt nur Coolify-Control-Plane (UI/DB/Redis/Realtime) — nicht App, nicht Supabase, nicht Caddy.
# Voraussetzung: Cutover auf Compose+Caddy ist grün (/opt/gwada/live läuft).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
LIVE_DIR="${GWADA_LIVE_COMPOSE_DIR:-/opt/gwada/live}"

if [[ "${GWADA_CONFIRM_STOP_COOLIFY:-}" != "STOP" ]]; then
  echo "Abbruch: setze GWADA_CONFIRM_STOP_COOLIFY=STOP" >&2
  exit 1
fi

echo "→ Stop Coolify control plane on ${SSH_USER}@${VPS}"

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${LIVE_DIR}" <<'REMOTE'
set -euo pipefail
LIVE_DIR="$1"

if [[ ! -f "${LIVE_DIR}/docker-compose.yml" ]]; then
  echo "Cutover-Compose fehlt (${LIVE_DIR}) — Coolify UI nicht stoppen." >&2
  exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -qx gwada-caddy; then
  echo "gwada-caddy läuft nicht — Abbruch." >&2
  exit 1
fi
if ! curl -fsS https://gwada.app/api/build-info >/dev/null; then
  echo "build-info unerreichbar — Coolify UI nicht stoppen." >&2
  exit 1
fi

# Nur Control-Plane — niemals supabase-*, gwada-app, gwada-caddy, authelia
for name in coolify coolify-realtime coolify-redis coolify-db; do
  if docker ps -a --format '{{.Names}}' | grep -qx "${name}"; then
    echo "Stoppe ${name} …"
    docker stop "${name}" || true
  fi
done

# coolify-proxy sollte nach Cutover schon gestoppt sein; sicherheitshalber
if docker ps --format '{{.Names}}' | grep -qx coolify-proxy; then
  echo "Stoppe coolify-proxy (sollte schon down sein) …"
  docker stop coolify-proxy || true
fi

echo "--- remaining coolify* ---"
docker ps -a --format '{{.Names}}\t{{.Status}}' | grep -i coolify || echo "(keine coolify-Container running/exited listed via grep)"
echo "--- edge ---"
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -iE 'gwada-caddy|gwada-app|coolify-proxy' || true
curl -fsS https://gwada.app/api/build-info || true
echo
echo "=== COOLIFY_UI_STOPPED_OK ==="
REMOTE
