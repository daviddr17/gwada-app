#!/usr/bin/env bash
# SSH-Tunnel Dev: Postgres localhost:5434 + Kong API localhost:8100
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

VPS="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
SSH_USER="${DEV_SSH_USER:-root}"
DB_LOCAL_PORT="${DEV_TUNNEL_LOCAL_PORT:-5434}"
API_LOCAL_PORT="${DEV_API_TUNNEL_LOCAL_PORT:-8100}"
REMOTE_DB_PORT="${DEV_TUNNEL_REMOTE_PORT:-5432}"
REMOTE_API_PORT="${DEV_API_TUNNEL_REMOTE_PORT:-8000}"

CONTROL_PATH="${TMPDIR:-/tmp}/gwada-ssh-dev-${SSH_USER}-${VPS}.sock"
SSH_BASE=(
  -o ControlMaster=auto
  -o "ControlPath=${CONTROL_PATH}"
  -o ControlPersist=600
  -o StrictHostKeyChecking=accept-new
)
if [[ -f "${GWADA_SSH_IDENTITY:-}" ]]; then
  SSH_BASE+=(-i "${GWADA_SSH_IDENTITY}")
fi

cleanup() {
  ssh "${SSH_BASE[@]}" -O exit "${SSH_USER}@${VPS}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

resolve_ips() {
  gwada_ssh "${SSH_USER}@${VPS}" bash <<'REMOTE'
set -euo pipefail
if [[ -f /opt/gwada-supabase-dev/.postgres_container_ip ]]; then
  db_ip="$(cat /opt/gwada-supabase-dev/.postgres_container_ip)"
else
  cd /opt/gwada-supabase-dev
  db_c="$(docker compose ps -q db)"
  db_ip="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${db_c}")"
fi
cd /opt/gwada-supabase-dev
kong_c="$(docker compose ps -q kong)"
kong_ip="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${kong_c}")"
echo "DB_IP=${db_ip}"
echo "KONG_IP=${kong_ip}"
REMOTE
}

eval "$(resolve_ips | tail -2)"

if [[ -n "${DEV_TUNNEL_REMOTE_HOST:-}" ]]; then
  DB_IP="${DEV_TUNNEL_REMOTE_HOST}"
fi
if [[ -n "${DEV_KONG_CONTAINER_IP:-}" ]]; then
  KONG_IP="${DEV_KONG_CONTAINER_IP}"
fi

echo ""
echo "Dev-Tunnel:"
echo "  Postgres  localhost:${DB_LOCAL_PORT} → ${DB_IP}:${REMOTE_DB_PORT}"
echo "  Kong API  localhost:${API_LOCAL_PORT} → ${KONG_IP}:${REMOTE_API_PORT}"
echo ""
echo "Terminal offen lassen. In anderem Terminal:"
echo "  pnpm dev          # nutzt .env.development"
echo "  pnpm db:push      # Migrationen auf Dev-DB"
echo ""

exec ssh "${SSH_BASE[@]}" -N \
  -L "${DB_LOCAL_PORT}:${DB_IP}:${REMOTE_DB_PORT}" \
  -L "${API_LOCAL_PORT}:${KONG_IP}:${REMOTE_API_PORT}" \
  "${SSH_USER}@${VPS}"
