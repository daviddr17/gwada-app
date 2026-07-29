#!/usr/bin/env bash
# Löst SSH-Ziel für WAHA-Ops: per-server via App-API oder LIVE_* Fallback.
# Erwartete Env: SERVER_ID, CRON_SECRET
# Optional: CONTAINER, GWADA_APP_ORIGIN, LIVE_SSH_KEY, LIVE_VPS_HOST
# Exportiert: WAHA_SSH_HOST, WAHA_SSH_USER, WAHA_SSH_PORT, WAHA_SSH_KEY_FILE, CONTAINER
set -euo pipefail

ORIGIN="${GWADA_APP_ORIGIN:-https://gwada.app}"
ORIGIN="${ORIGIN%/}"

if [[ -z "${SERVER_ID:-}" ]]; then
  echo "::error::SERVER_ID fehlt für WAHA-SSH-Resolve."
  exit 1
fi
if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "::error::CRON_SECRET fehlt — kann SSH-Config nicht von der App laden."
  exit 1
fi

ENCODED_ID="$(
  SERVER_ID="${SERVER_ID}" python3 - <<'PY'
import os, urllib.parse
print(urllib.parse.quote(os.environ["SERVER_ID"], safe=""))
PY
)"

CFG_JSON="$(
  curl -fsS \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    -H "Accept: application/json" \
    "${ORIGIN}/api/internal/waha-ssh-config?server_id=${ENCODED_ID}"
)"

MODE="$(printf '%s' "${CFG_JSON}" | jq -r '.mode // empty')"
API_CONTAINER="$(printf '%s' "${CFG_JSON}" | jq -r '.containerName // empty')"
if [[ -z "${CONTAINER:-}" || "${CONTAINER}" == "auto" ]]; then
  if [[ -n "${API_CONTAINER}" ]]; then
    CONTAINER="${API_CONTAINER}"
  else
    CONTAINER="${CONTAINER:-auto}"
  fi
fi

mkdir -p ~/.ssh
chmod 700 ~/.ssh
KEY_FILE="${HOME}/.ssh/waha_ops_ed25519"

if [[ "${MODE}" == "per_server" ]]; then
  HOST="$(printf '%s' "${CFG_JSON}" | jq -r '.host')"
  USER="$(printf '%s' "${CFG_JSON}" | jq -r '.user // "root"')"
  PORT="$(printf '%s' "${CFG_JSON}" | jq -r '.port // 22')"
  KEY="$(printf '%s' "${CFG_JSON}" | jq -r '.privateKey // empty')"
  if [[ -z "${HOST}" || -z "${KEY}" ]]; then
    echo "::error::per_server-Config unvollständig (host/key)."
    exit 1
  fi
  while IFS= read -r line; do
    [[ -n "${line}" ]] && echo "::add-mask::${line}"
  done <<< "${KEY}"
  printf '%s\n' "${KEY}" > "${KEY_FILE}"
  chmod 600 "${KEY_FILE}"
  echo "WAHA SSH-Ziel: ${USER}@${HOST}:${PORT} (per-server, container=${CONTAINER})"
elif [[ "${MODE}" == "legacy_live_vps" ]]; then
  if [[ -z "${LIVE_SSH_KEY:-}" || -z "${LIVE_VPS_HOST:-}" ]]; then
    echo "::error::Kein per-server SSH und LIVE_SSH_KEY/LIVE_VPS_HOST fehlen. Unter Superadmin → WAHA SSH-Host+Key setzen."
    exit 1
  fi
  HOST="${LIVE_VPS_HOST}"
  USER="root"
  PORT="22"
  printf '%s\n' "${LIVE_SSH_KEY}" > "${KEY_FILE}"
  chmod 600 "${KEY_FILE}"
  echo "WAHA SSH-Ziel: ${USER}@${HOST}:${PORT} (legacy LIVE_VPS, container=${CONTAINER})"
else
  ERR="$(printf '%s' "${CFG_JSON}" | jq -r '.error // .message // "unknown"')"
  echo "::error::SSH-Config fehlgeschlagen: ${ERR}"
  exit 1
fi

ssh-keyscan -p "${PORT}" -H "${HOST}" >> ~/.ssh/known_hosts 2>/dev/null || true

export WAHA_SSH_HOST="${HOST}"
export WAHA_SSH_USER="${USER}"
export WAHA_SSH_PORT="${PORT}"
export WAHA_SSH_KEY_FILE="${KEY_FILE}"
export CONTAINER
