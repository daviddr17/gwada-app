#!/usr/bin/env bash
# CI: Migrationen auf Dev-DB — läuft auf dem VPS im Docker-Netz (kein Runner-Tunnel).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_COMPOSE_DIR="${DEV_COMPOSE_DIR:-/opt/gwada-supabase-dev}"
export DEV_REMOTE_MIG_DIR="${DEV_REMOTE_MIG_DIR:-/tmp/gwada-dev-migrations}"

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

if ! gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zum VPS fehlgeschlagen." >&2
  exit 1
fi

echo "Übertrage Migrationen …"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "rm -rf ${DEV_REMOTE_MIG_DIR} && mkdir -p ${DEV_REMOTE_MIG_DIR}"
tar -C "${ROOT}" -czf - supabase/migrations supabase/config.toml \
  | gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "tar -xzf - -C ${DEV_REMOTE_MIG_DIR}"

echo ""
echo "=== Dev-DB: Migrationen anwenden (VPS psql, Multi-Pass) ==="
gwada_scp_cmd "${ROOT}/scripts/vps-deploy-dev-db-remote.sh" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}:/tmp/vps-deploy-dev-db-remote.sh"
gwada_scp_cmd "${ROOT}/scripts/vps-bootstrap-dev-storage.sql" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}:/tmp/vps-bootstrap-dev-storage.sql"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "bash /tmp/vps-deploy-dev-db-remote.sh ${DEV_COMPOSE_DIR} ${DEV_REMOTE_MIG_DIR}"

echo ""
echo "→ Dev-Stack hochfahren + Auth/REST neu laden …"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" bash <<REMOTE
set -euo pipefail
cd "${DEV_COMPOSE_DIR}"
export COMPOSE_PROJECT_NAME=gwada-dev
mapfile -t DEV_SERVICES < <(docker compose config --services | grep -Ev '^(supavisor|pooler)$' || true)
docker compose up -d "\${DEV_SERVICES[@]}"
docker compose exec -T db psql -U postgres -c "NOTIFY pgrst, 'reload schema';" 2>/dev/null || true
docker compose up -d --force-recreate auth rest 2>/dev/null || docker compose restart auth rest
REMOTE

echo ""
echo "Dev-DB-Migrationen angewendet."
