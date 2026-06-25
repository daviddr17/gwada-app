#!/usr/bin/env bash
# Täglicher Dev-Start: Env sync, API prüfen, optional Tunnel, next dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ROOT}/.env.development"
TUNNEL_PID_FILE="${TMPDIR:-/tmp}/gwada-dev-tunnel.pid"
DEV_PID_FILE="${TMPDIR:-/tmp}/gwada-dev-next.pid"

log() { echo "[dev-start] $*"; }

ensure_env() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    log "Hole .env.development vom letzten CI-Run …"
    pnpm setup:dev:env
  fi
}

api_url() {
  # shellcheck disable=SC1090
  set -a
  # shellcheck source=/dev/null
  source <(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "${ENV_FILE}")
  set +a
  echo "${NEXT_PUBLIC_SUPABASE_URL}"
}

api_reachable() {
  local url="$1"
  curl -sf --connect-timeout 3 "${url%/}/auth/v1/health" >/dev/null 2>&1
}

start_tunnel_bg() {
  if [[ -f "${TUNNEL_PID_FILE}" ]] && kill -0 "$(cat "${TUNNEL_PID_FILE}")" 2>/dev/null; then
    log "Tunnel läuft bereits (PID $(cat "${TUNNEL_PID_FILE}"))."
    return 0
  fi
  log "Starte SSH-Tunnel im Hintergrund …"
  bash "${ROOT}/scripts/db-tunnel-dev.sh" &
  echo $! > "${TUNNEL_PID_FILE}"
  for _ in $(seq 1 20); do
    if nc -z 127.0.0.1 8100 2>/dev/null; then
      log "Tunnel bereit (localhost:8100)."
      return 0
    fi
    sleep 1
  done
  log "Tunnel nicht bereit — nutze direkte VPS-URL falls erreichbar."
  return 1
}

ensure_env

URL="$(api_url)"
if ! api_reachable "${URL}"; then
  # Fallback: Tunnel-URL probieren
  if api_reachable "http://127.0.0.1:8100"; then
    log "API über localhost:8100 erreichbar."
  else
    start_tunnel_bg || true
    if api_reachable "http://127.0.0.1:8100"; then
      export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:8100"
    fi
  fi
fi

log "Starte pnpm dev …"
exec pnpm --filter web dev
