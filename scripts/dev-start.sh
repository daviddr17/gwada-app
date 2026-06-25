#!/usr/bin/env bash
# Täglicher Dev-Start: Env vom VPS-CI holen, .env.local sync, API prüfen, next dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ROOT}/.env.development"
TUNNEL_PID_FILE="${TMPDIR:-/tmp}/gwada-dev-tunnel.pid"

log() { echo "[dev-start] $*"; }

ensure_env() {
  log "Aktualisiere .env.development vom letzten Dev-CI-Run …"
  pnpm setup:dev:env 2>/dev/null || true
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Fehler: .env.development fehlt. CI-Workflow seed-dev-db.yml muss einmal laufen." >&2
    exit 1
  fi
  log "Synchronisiere .env.local → Remote-Dev …"
  pnpm env:sync:dev
}

api_url() {
  grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "${ENV_FILE}" | head -1 | cut -d= -f2- | tr -d '\r'
}

api_reachable() {
  local url="$1"
  curl -sf --connect-timeout 3 "${url%/}/rest/v1/" -H "apikey: probe" >/dev/null 2>&1 \
    || curl -sf --connect-timeout 3 "${url%/}/auth/v1/health" >/dev/null 2>&1
}

start_tunnel_bg() {
  if [[ -f "${TUNNEL_PID_FILE}" ]] && kill -0 "$(cat "${TUNNEL_PID_FILE}")" 2>/dev/null; then
    return 0
  fi
  log "Starte SSH-Tunnel im Hintergrund …"
  bash "${ROOT}/scripts/db-tunnel-dev.sh" &
  echo $! > "${TUNNEL_PID_FILE}"
  for _ in $(seq 1 20); do
    nc -z 127.0.0.1 8100 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

ensure_env

URL="$(api_url)"
if ! api_reachable "${URL}"; then
  start_tunnel_bg || true
fi

log "Starte Next.js …"
exec pnpm --filter web exec dotenv -e ../../.env.development -- next dev --webpack
