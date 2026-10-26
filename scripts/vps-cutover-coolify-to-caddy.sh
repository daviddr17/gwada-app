#!/usr/bin/env bash
# Live-Cutover: Coolify-Traefik → Caddy + /opt/gwada/live Compose.
# Destruktiv für Edge-Proxy — nur mit Snapshot + Bestätigung.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
APP_ID="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
LIVE_DIR="${GWADA_LIVE_COMPOSE_DIR:-/opt/gwada/live}"
SUPABASE_NET="${GWADA_SUPABASE_DOCKER_NETWORK:-oogd5syyxiqb1k4g0wy1u9n8}"
APP_ORIGIN="${APP_ORIGIN:-https://gwada.app}"

if [[ "${GWADA_CONFIRM_CADDY_CUTOVER:-}" != "CUTOVER" ]]; then
  echo "Abbruch: setze GWADA_CONFIRM_CADDY_CUTOVER=CUTOVER (Contabo-Snapshot vorausgesetzt)." >&2
  exit 1
fi
if [[ "${GWADA_SNAPSHOT_DONE:-}" != "yes" ]]; then
  echo "Abbruch: setze GWADA_SNAPSHOT_DONE=yes nachdem Contabo-Snapshot existiert." >&2
  exit 1
fi

echo "→ Cutover Coolify→Caddy auf ${SSH_USER}@${VPS} (live_dir=${LIVE_DIR})"

# Lokale Vorlagen nach /tmp auf Remote, dann installieren
REMOTE_STAGING="/tmp/gwada-live-cutover-$$"
gwada_ssh "${SSH_USER}@${VPS}" "rm -rf '${REMOTE_STAGING}' && mkdir -p '${REMOTE_STAGING}'"
gwada_ssh "${SSH_USER}@${VPS}" "cat > '${REMOTE_STAGING}/docker-compose.yml'" \
  < "${ROOT}/deploy/live/docker-compose.yml"
gwada_ssh "${SSH_USER}@${VPS}" "cat > '${REMOTE_STAGING}/Caddyfile'" \
  < "${ROOT}/deploy/live/Caddyfile"
gwada_ssh "${SSH_USER}@${VPS}" "cat > '${REMOTE_STAGING}/cutover-remote.sh'" \
  < "${ROOT}/scripts/vps-cutover-coolify-to-caddy-remote.sh"
gwada_ssh "${SSH_USER}@${VPS}" "chmod +x '${REMOTE_STAGING}/cutover-remote.sh'"

gwada_ssh "${SSH_USER}@${VPS}" \
  "GWADA_LIVE_COMPOSE_DIR=$(printf '%q' "${LIVE_DIR}") \
   GWADA_COOLIFY_APP_UUID=$(printf '%q' "${APP_ID}") \
   GWADA_SUPABASE_DOCKER_NETWORK=$(printf '%q' "${SUPABASE_NET}") \
   APP_ORIGIN=$(printf '%q' "${APP_ORIGIN}") \
   GWADA_CUTOVER_STAGING=$(printf '%q' "${REMOTE_STAGING}") \
   bash '${REMOTE_STAGING}/cutover-remote.sh'"

echo "→ Remote-Cutover fertig. Verify:"
curl -fsS "${APP_ORIGIN}/api/build-info" || true
echo
curl -sI "https://studio.new.gwada.app" | head -8 || true
curl -sI "https://auth.new.gwada.app" | head -8 || true
