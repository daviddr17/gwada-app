#!/usr/bin/env bash
# Dev-Server im Hintergrund (idempotent) oder Vordergrund (--foreground).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FOREGROUND=0
[[ "${1:-}" == "--foreground" ]] && FOREGROUND=1

ENV_FILE="${ROOT}/.env.development"
PID_FILE="${TMPDIR:-/tmp}/gwada-dev-server.pid"
LOG_FILE="${TMPDIR:-/tmp}/gwada-dev-server.log"
PORT=3000

log() { echo "[dev-server] $*"; }

if lsof -tiTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  log "Läuft bereits auf Port ${PORT}."
  exit 0
fi

if [[ -f "${PID_FILE}" ]]; then
  old_pid="$(cat "${PID_FILE}")"
  if kill -0 "${old_pid}" 2>/dev/null; then
    log "Läuft bereits (PID ${old_pid})."
    exit 0
  fi
  rm -f "${PID_FILE}"
fi

log "Env sync …"
pnpm setup:dev:env 2>/dev/null || true
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Fehler: .env.development fehlt." >&2
  exit 1
fi
pnpm env:sync:dev >/dev/null

if [[ "${FOREGROUND}" -eq 1 ]]; then
  log "Starte Next.js (Vordergrund) …"
  exec pnpm --filter web dev
fi

log "Starte Next.js im Hintergrund …"
nohup pnpm --filter web dev >>"${LOG_FILE}" 2>&1 &
server_pid=$!
echo "${server_pid}" > "${PID_FILE}"

for _ in $(seq 1 45); do
  if curl -sf --connect-timeout 1 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    log "Bereit: http://localhost:${PORT}"
    exit 0
  fi
  sleep 1
done

log "Gestartet (PID $(cat "${PID_FILE}")), noch nicht bereit — Log: ${LOG_FILE}"
exit 0
