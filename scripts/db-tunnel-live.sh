#!/usr/bin/env bash
# SSH-Tunnel: localhost:5433 → Postgres-Container auf dem VPS (Docker-IP, z. B. 10.0.2.6)
set -euo pipefail

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
LOCAL_PORT="${LIVE_TUNNEL_LOCAL_PORT:-5433}"
REMOTE_PORT="${LIVE_TUNNEL_REMOTE_PORT:-5432}"
CONTAINER_GREP="${LIVE_DB_CONTAINER_GREP:-supabase-db}"

CONTROL_PATH="${TMPDIR:-/tmp}/gwada-ssh-${SSH_USER}-${VPS}.sock"
SSH_BASE=(
  -o ControlMaster=auto
  -o "ControlPath=${CONTROL_PATH}"
  -o ControlPersist=600
  -o StrictHostKeyChecking=accept-new
)

cleanup() {
  ssh "${SSH_BASE[@]}" -O exit "${SSH_USER}@${VPS}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

resolve_remote_host() {
  if [[ -n "${LIVE_TUNNEL_REMOTE_HOST:-}" ]]; then
    echo "${LIVE_TUNNEL_REMOTE_HOST}"
    return
  fi

  echo "Ermittle Postgres-Container auf ${VPS} (grep: ${CONTAINER_GREP})…" >&2
  ssh "${SSH_BASE[@]}" "${SSH_USER}@${VPS}" bash -s -- "${CONTAINER_GREP}" <<'REMOTE'
set -euo pipefail
grep_pat="$1"
c="$(docker ps --format '{{.Names}}' | grep "${grep_pat}" | head -1 || true)"
if [[ -z "${c}" ]]; then
  echo "Kein laufender Container für Pattern: ${grep_pat}" >&2
  docker ps --format '{{.Names}}' >&2
  exit 1
fi
ip="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${c}")"
if [[ -z "${ip}" ]]; then
  echo "Keine IP für Container ${c}" >&2
  exit 1
fi
echo "Container ${c} → ${ip}" >&2
echo "${ip}"
REMOTE
}

REMOTE_HOST="$(resolve_remote_host | tail -1)"

echo ""
echo "Tunnel: localhost:${LOCAL_PORT} → ${REMOTE_HOST}:${REMOTE_PORT} (via ${SSH_USER}@${VPS})"
echo "SSH: Passwort nur einmal (zwei Schritte, eine Session)."
echo ""
echo "Terminal offen lassen. Neues Terminal:"
echo "  npm run db:push:live -- --dry-run"
echo ""
echo "Bekannte IP (ohne erneute Container-Suche):"
echo "  LIVE_TUNNEL_REMOTE_HOST=${REMOTE_HOST} npm run db:tunnel:live"
echo ""

exec ssh "${SSH_BASE[@]}" -N -L "${LOCAL_PORT}:${REMOTE_HOST}:${REMOTE_PORT}" "${SSH_USER}@${VPS}"
