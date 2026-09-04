#!/usr/bin/env bash
# Read-only Preflight für die Skalierung ab ~30 Restaurants.
# Provisioniert nichts. Mit GWADA_CONFIRM_SCALE_AT_30=1 nur ausführlicheres Logging.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
APP_ID="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
CONFIRM="${GWADA_CONFIRM_SCALE_AT_30:-0}"

echo "VPS-Scale Preflight (read-only) → ${SSH_USER}@${VPS}"
echo "Coolify-App: ${APP_ID}"
if [[ "${CONFIRM}" == "1" ]]; then
  echo "GWADA_CONFIRM_SCALE_AT_30=1 — immer noch kein Provisioning, nur Extra-Checks."
fi

if ! gwada_ssh "${SSH_USER}@${VPS}" true; then
  echo "SSH fehlgeschlagen (${SSH_USER}@${VPS})." >&2
  exit 1
fi

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${APP_ID@Q}" "${CONFIRM@Q}" <<'REMOTE'
set -euo pipefail
app_id="$1"
confirm="$2"
compose_dir="/data/coolify/applications/${app_id}"

echo "--- disk ---"
df -h / | tail -1
echo "--- memory ---"
free -h | sed -n '1,2p'
echo "--- docker ---"
docker info >/dev/null
echo "docker ok"
echo "--- coolify app ---"
if [[ ! -d "${compose_dir}" ]]; then
  echo "Coolify-Verzeichnis fehlt: ${compose_dir}" >&2
  exit 1
fi
echo "compose_dir=${compose_dir}"
if [[ -f "${compose_dir}/.env" ]]; then
  echo "env_present=yes"
else
  echo "env_present=no" >&2
  exit 1
fi
echo "--- running app containers ---"
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'd3cg1b54arvue2tcm8u34qty|gwada' || true
echo "--- crontab marker ---"
crontab -l 2>/dev/null | grep -c 'BEGIN gwada-critical-cron' || true
echo "--- supabase containers ---"
docker ps --format '{{.Names}}' | grep -E 'supabase|kong|postgres' || true
if [[ "${confirm}" == "1" ]]; then
  echo "--- image ---"
  docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -E 'gwada-app|ghcr.io/daviddr17' | head -5 || true
fi
echo "preflight_ok"
REMOTE

echo "✓ Preflight ok. Nächster Schritt nur nach Ansage: Stufe A/B in docs/runbook-vps-scale-at-30.md"
