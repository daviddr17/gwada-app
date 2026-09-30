#!/usr/bin/env bash
# Shared SSH tunnel helpers (sourced, not executed directly)
set -euo pipefail

: "${LIVE_VPS_HOST:=95.111.229.250}"
: "${LIVE_SSH_USER:=root}"
: "${LIVE_TUNNEL_LOCAL_PORT:=5433}"
: "${LIVE_TUNNEL_REMOTE_PORT:=5432}"
: "${LIVE_DB_CONTAINER_GREP:=supabase-db}"

GWADA_SSH_CONTROL_PATH="${TMPDIR:-/tmp}/gwada-ssh-${LIVE_SSH_USER}-${LIVE_VPS_HOST}.sock"
GWADA_TUNNEL_STARTED_BY_US=0

GWADA_SSH_OPTS=(
  -o ControlMaster=auto
  -o "ControlPath=${GWADA_SSH_CONTROL_PATH}"
  -o ControlPersist=600
  -o StrictHostKeyChecking=accept-new
  -o BatchMode=yes
)

: "${GWADA_SSH_IDENTITY:=${HOME}/.ssh/gwada_vps_ed25519}"
if [[ ! -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH_IDENTITY="${HOME}/.ssh/id_ed25519"
fi
if [[ -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH_OPTS+=(-i "${GWADA_SSH_IDENTITY}")
fi

gwada_ssh_cmd() {
  ssh "${GWADA_SSH_OPTS[@]}" "$@"
}

# Postgres hinter https://gwada.app/sb: gleicher Compose-Stack wie supabase-kong-*.
# `grep supabase-db | head -1` trifft sonst den anderen Stack (z. B. 10.0.3.3).
gwada_resolve_app_db_container() {
  gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" bash -s <<'REMOTE'
set -euo pipefail
kong="$(docker ps --format '{{.Names}}' | grep -E '^supabase-kong-' | head -1 || true)"
if [[ -z "${kong}" ]]; then
  echo "Coolify-Kong (supabase-kong-*) nicht gefunden." >&2
  exit 1
fi
project="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "${kong}")"
project="${project//$'\r'/}"
db="$(docker ps --filter "label=com.docker.compose.project=${project}" --format '{{.Names}}' | grep -E 'supabase-db' | head -1 || true)"
db="${db//$'\r'/}"
if [[ -z "${db}" ]]; then
  echo "DB zum Kong ${kong} (project ${project}) nicht gefunden." >&2
  exit 1
fi
printf '%s\n' "${db}"
REMOTE
}

gwada_resolve_container_ip() {
  if [[ -n "${LIVE_TUNNEL_REMOTE_HOST:-}" ]]; then
    echo "${LIVE_TUNNEL_REMOTE_HOST}"
    return
  fi
  local name
  name="$(gwada_resolve_app_db_container | tail -1)"
  name="${name//$'\r'/}"
  echo "App-DB-Container=${name}" >&2
  gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" \
    docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "${name}" \
    | awk '{print $1}'
}

gwada_tunnel_port_open() {
  nc -z 127.0.0.1 "${LIVE_TUNNEL_LOCAL_PORT}" 2>/dev/null
}

gwada_tunnel_start_bg() {
  if gwada_tunnel_port_open; then
    echo "Tunnel-Port 127.0.0.1:${LIVE_TUNNEL_LOCAL_PORT} bereits offen — wird wiederverwendet."
    return 0
  fi

  local remote_host
  remote_host="$(gwada_resolve_container_ip | tail -1)"
  echo "Starte Tunnel → ${remote_host}:${LIVE_TUNNEL_REMOTE_PORT} …"

  gwada_ssh_cmd -f -N -L "${LIVE_TUNNEL_LOCAL_PORT}:${remote_host}:${LIVE_TUNNEL_REMOTE_PORT}" \
    "${LIVE_SSH_USER}@${LIVE_VPS_HOST}"

  local i
  for i in $(seq 1 15); do
    if gwada_tunnel_port_open; then
      GWADA_TUNNEL_STARTED_BY_US=1
      echo "Tunnel bereit (localhost:${LIVE_TUNNEL_LOCAL_PORT})."
      return 0
    fi
    sleep 1
  done

  echo "Tunnel-Port ${LIVE_TUNNEL_LOCAL_PORT} nicht erreichbar." >&2
  return 1
}

gwada_tunnel_stop() {
  if [[ "${GWADA_TUNNEL_STARTED_BY_US}" -eq 1 ]]; then
    gwada_ssh_cmd -O exit "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" 2>/dev/null || true
    GWADA_TUNNEL_STARTED_BY_US=0
  fi
}
