#!/usr/bin/env bash
# CI: Migrationen auf Dev-DB (VPS /opt/gwada-supabase-dev)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_TUNNEL_LOCAL_PORT="${DEV_TUNNEL_LOCAL_PORT:-5434}"
export DEV_TUNNEL_REMOTE_PORT="${DEV_TUNNEL_REMOTE_PORT:-5432}"
export DEV_DB_CONTAINER_GREP="${DEV_DB_CONTAINER_GREP:-gwada-supabase-dev.*db|supabase-db}"

GWADA_SSH_CONTROL_PATH="${TMPDIR:-/tmp}/gwada-ssh-dev-${DEV_SSH_USER}-${DEV_VPS_HOST}.sock"
GWADA_TUNNEL_STARTED_BY_US=0

GWADA_SSH_OPTS=(
  -o ControlMaster=auto
  -o "ControlPath=${GWADA_SSH_CONTROL_PATH}"
  -o ControlPersist=600
  -o StrictHostKeyChecking=accept-new
  -o BatchMode=yes
)

: "${GWADA_SSH_IDENTITY:=${HOME}/.ssh/id_ed25519}"
if [[ -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH_OPTS+=(-i "${GWADA_SSH_IDENTITY}")
fi

gwada_ssh_cmd() {
  ssh "${GWADA_SSH_OPTS[@]}" "$@"
}

gwada_tunnel_port_open() {
  nc -z 127.0.0.1 "${DEV_TUNNEL_LOCAL_PORT}" 2>/dev/null
}

gwada_resolve_dev_db_ip() {
  if [[ -n "${DEV_TUNNEL_REMOTE_HOST:-}" ]]; then
    echo "${DEV_TUNNEL_REMOTE_HOST}"
    return
  fi
  local ip_file="/opt/gwada-supabase-dev/.postgres_container_ip"
  gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "cat ${ip_file} 2>/dev/null" || true
}

cleanup() {
  if [[ "${GWADA_TUNNEL_STARTED_BY_US}" -eq 1 ]]; then
    gwada_ssh_cmd -O exit "${DEV_SSH_USER}@${DEV_VPS_HOST}" 2>/dev/null || true
    GWADA_TUNNEL_STARTED_BY_US=0
  fi
}
trap cleanup EXIT INT TERM

if ! gwada_ssh_cmd -o ConnectTimeout=8 "${DEV_SSH_USER}@${DEV_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zum VPS fehlgeschlagen." >&2
  exit 1
fi

remote_host="$(gwada_resolve_dev_db_ip | tail -1 | tr -d '\r')"
if [[ -z "${remote_host}" ]]; then
  remote_host="$(
    gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/gwada-supabase-dev 2>/dev/null || exit 1
c="$(docker compose ps -q db)"
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${c}"
REMOTE
  )"
fi
remote_host="${remote_host//$'\r'/}"
[[ -n "${remote_host}" ]] || { echo "Dev-Postgres-IP nicht gefunden — zuerst provision-dev-supabase." >&2; exit 1; }

if ! gwada_tunnel_port_open; then
  echo "Starte Dev-DB-Tunnel → ${remote_host}:${DEV_TUNNEL_REMOTE_PORT} …"
  gwada_ssh_cmd -f -N -L "${DEV_TUNNEL_LOCAL_PORT}:${remote_host}:${DEV_TUNNEL_REMOTE_PORT}" \
    "${DEV_SSH_USER}@${DEV_VPS_HOST}"
  for _ in $(seq 1 15); do
    if gwada_tunnel_port_open; then
      GWADA_TUNNEL_STARTED_BY_US=1
      break
    fi
    sleep 1
  done
fi

POSTGRES_PASSWORD="$(
  gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
    "cd /opt/gwada-supabase-dev && docker compose exec -T db printenv POSTGRES_PASSWORD"
)"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD//$'\r'/}"

export SUPABASE_DB_URL="postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:${DEV_TUNNEL_LOCAL_PORT}/postgres?sslmode=disable"
export PGSSLMODE=disable

echo ""
echo "=== Dev-DB: Migrationen anwenden (nur Schema) ==="
bash scripts/db-push-live.sh --yes --include-all "$@"

echo ""
echo "Dev-DB-Migrationen angewendet."
