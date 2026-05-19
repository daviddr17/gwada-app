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

gwada_ssh_cmd() {
  ssh "${GWADA_SSH_OPTS[@]}" "$@"
}

gwada_resolve_container_ip() {
  if [[ -n "${LIVE_TUNNEL_REMOTE_HOST:-}" ]]; then
    echo "${LIVE_TUNNEL_REMOTE_HOST}"
    return
  fi
  gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" bash -s -- "${LIVE_DB_CONTAINER_GREP}" <<'REMOTE'
set -euo pipefail
grep_pat="$1"
c="$(docker ps --format '{{.Names}}' | grep "${grep_pat}" | head -1 || true)"
[[ -n "${c}" ]] || { echo "Kein Container: ${grep_pat}" >&2; exit 1; }
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${c}"
REMOTE
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
