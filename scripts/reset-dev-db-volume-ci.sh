#!/usr/bin/env bash
# CI: Dev-Postgres-Volume auf dem VPS zurücksetzen.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_COMPOSE_DIR="${DEV_COMPOSE_DIR:-/opt/gwada-supabase-dev}"

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

gwada_scp_cmd "${ROOT}/scripts/vps-reset-dev-db-volume-remote.sh" \
  "${ROOT}/scripts/vps-provision-dev-supabase.sh" \
  "${ROOT}/scripts/vps-refresh-dev-env.sh" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}:/tmp/"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "bash /tmp/vps-reset-dev-db-volume-remote.sh ${DEV_COMPOSE_DIR}"
