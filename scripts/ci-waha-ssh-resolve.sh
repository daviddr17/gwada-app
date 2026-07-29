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

write_ssh_key() {
  local raw="$1"
  # Literal \n aus JSON/UI → echte Zeilenumbrüche; CRLF entfernen
  KEY="$(
    KEY_RAW="${raw}" python3 - <<'PY'
import os, re
text = os.environ["KEY_RAW"].replace("\r\n", "\n").replace("\r", "\n")
text = text.replace("\\n", "\n").strip()
if "BEGIN" not in text or "PRIVATE KEY" not in text:
    raise SystemExit("SSH private key ungültig (BEGIN PRIVATE KEY fehlt).")
# Softwrap/Copy ohne echte Newlines → PEM wiederherstellen
if "\n" not in text:
    m_b = re.match(r"^(-----BEGIN [^-]+-----)", text)
    m_e = re.search(r"(-----END [^-]+-----)$", text)
    if m_b and m_e:
        body = text[len(m_b.group(1)) : -len(m_e.group(1))]
        chunks = [body[i : i + 70] for i in range(0, len(body), 70)]
        text = "\n".join([m_b.group(1), *chunks, m_e.group(1)])
text = text.strip() + "\n"
print(text, end="")
PY
  )"
  while IFS= read -r line; do
    [[ -n "${line}" ]] && echo "::add-mask::${line}"
  done <<< "${KEY}"
  # Nicht printf '%s' mit %-Zeichen im Key riskieren — python schreibt die Datei
  KEY="${KEY}" KEY_FILE="${KEY_FILE}" python3 - <<'PY'
import os
from pathlib import Path
Path(os.environ["KEY_FILE"]).write_text(os.environ["KEY"], encoding="utf-8")
PY
  chmod 600 "${KEY_FILE}"
  if ! ssh-keygen -y -f "${KEY_FILE}" >/dev/null 2>&1; then
    echo "::error::SSH-Key-Datei ungültig (ssh-keygen -y fehlgeschlagen)."
    exit 1
  fi
  PUB_FP="$(ssh-keygen -lf "${KEY_FILE}" 2>/dev/null | awk '{print $2}')"
  echo "SSH-Key Fingerprint: ${PUB_FP:-unbekannt}"
}

if [[ "${MODE}" == "per_server" ]]; then
  HOST="$(printf '%s' "${CFG_JSON}" | jq -r '.host')"
  USER="$(printf '%s' "${CFG_JSON}" | jq -r '.user // "root"')"
  PORT="$(printf '%s' "${CFG_JSON}" | jq -r '.port // 22')"
  KEY_RAW="$(printf '%s' "${CFG_JSON}" | jq -r '.privateKey // empty')"
  if [[ -z "${HOST}" || -z "${KEY_RAW}" ]]; then
    echo "::error::per_server-Config unvollständig (host/key)."
    exit 1
  fi
  write_ssh_key "${KEY_RAW}"
  echo "WAHA SSH-Ziel: ${USER}@${HOST}:${PORT} (per-server, container=${CONTAINER})"
elif [[ "${MODE}" == "legacy_live_vps" ]]; then
  if [[ -z "${LIVE_SSH_KEY:-}" || -z "${LIVE_VPS_HOST:-}" ]]; then
    echo "::error::Kein per-server SSH und LIVE_SSH_KEY/LIVE_VPS_HOST fehlen. Unter Superadmin → WAHA SSH-Host+Key setzen."
    exit 1
  fi
  HOST="${LIVE_VPS_HOST}"
  USER="root"
  PORT="22"
  write_ssh_key "${LIVE_SSH_KEY}"
  echo "WAHA SSH-Ziel: ${USER}@${HOST}:${PORT} (legacy LIVE_VPS, container=${CONTAINER})"
else
  ERR="$(printf '%s' "${CFG_JSON}" | jq -r '.error // .message // "unknown"')"
  echo "::error::SSH-Config fehlgeschlagen: ${ERR}"
  exit 1
fi

ssh-keyscan -p "${PORT}" -H "${HOST}" >> ~/.ssh/known_hosts 2>/dev/null || true

# Schneller Auth-Check bevor der lange Remote-Block läuft
if ! ssh -i "${KEY_FILE}" -o BatchMode=yes -o ConnectTimeout=20 \
  -p "${PORT}" "${USER}@${HOST}" true; then
  echo "::error::SSH Login auf ${USER}@${HOST}:${PORT} abgelehnt (publickey). Öffentlichen Key auf dem WAHA-Host in authorized_keys legen — gleicher Key wie in Superadmin."
  exit 1
fi

export WAHA_SSH_HOST="${HOST}"
export WAHA_SSH_USER="${USER}"
export WAHA_SSH_PORT="${PORT}"
export WAHA_SSH_KEY_FILE="${KEY_FILE}"
export CONTAINER
