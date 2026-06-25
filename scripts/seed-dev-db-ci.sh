#!/usr/bin/env bash
# Spiegelt lokale Supabase-Seeds (config.toml [db.seed]) auf die Dev-DB auf dem VPS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_COMPOSE_DIR="${DEV_COMPOSE_DIR:-/opt/gwada-supabase-dev}"
export DEV_DOCKER_NETWORK="${DEV_DOCKER_NETWORK:-gwada-dev_default}"
export DEV_REMOTE_DIR="${DEV_REMOTE_DIR:-/tmp/gwada-dev-seeds}"

: "${GWADA_SSH_IDENTITY:=${HOME}/.ssh/id_ed25519}"
GWADA_SSH_OPTS=(-o ConnectTimeout=15 -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
if [[ -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH_OPTS+=(-i "${GWADA_SSH_IDENTITY}")
fi

gwada_ssh_cmd() {
  ssh "${GWADA_SSH_OPTS[@]}" -o LogLevel=ERROR "$@"
}
gwada_scp_cmd() {
  scp "${GWADA_SSH_OPTS[@]}" "$@"
}

SEED_FILES=(
  supabase/seed.sql
  supabase/seed_menu_relational.sql
  supabase/seed_inventory_relational.sql
  supabase/seed_demo_user.sql
  supabase/seed_dining_floor_demo.sql
  supabase/seed_reservations_demo.sql
)

if ! gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zum VPS fehlgeschlagen." >&2
  exit 1
fi

echo "Übertrage Seed-Dateien …"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "rm -rf ${DEV_REMOTE_DIR} && mkdir -p ${DEV_REMOTE_DIR}"
tar -C "${ROOT}" -czf - "${SEED_FILES[@]}" \
  | gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "tar -xzf - -C ${DEV_REMOTE_DIR}"

echo ""
echo "=== Dev-DB: lokale Seeds anwenden ==="
gwada_scp_cmd "${ROOT}/scripts/vps-seed-dev-db-remote.sh" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}:/tmp/vps-seed-dev-db-remote.sh"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "bash /tmp/vps-seed-dev-db-remote.sh ${DEV_COMPOSE_DIR} ${DEV_DOCKER_NETWORK} ${DEV_REMOTE_DIR}"

gwada_scp_cmd "${ROOT}/scripts/vps-verify-dev-auth-remote.sh" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}:/tmp/vps-verify-dev-auth-remote.sh"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "bash /tmp/vps-verify-dev-auth-remote.sh ${DEV_COMPOSE_DIR}"
