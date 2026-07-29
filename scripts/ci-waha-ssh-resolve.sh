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
  # Wichtig: Key nicht über bash $(…) normalisieren — Command-Substitution
  # entfernt trailing newlines (411 → 410) und macht OpenSSH-Keys kaputt.
  KEY_RAW="${raw}" KEY_FILE="${KEY_FILE}" python3 - <<'PY'
import base64, os, re
from pathlib import Path

text = os.environ["KEY_RAW"].replace("\r\n", "\n").replace("\r", "\n")
text = text.replace("\\n", "\n").strip()
if "BEGIN" not in text:
    try:
        decoded = base64.b64decode(re.sub(r"\s+", "", text), validate=False).decode("utf-8")
        if "BEGIN" in decoded and "PRIVATE KEY" in decoded:
            text = decoded.strip()
    except Exception:
        pass
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
path = Path(os.environ["KEY_FILE"])
path.write_text(text, encoding="utf-8")
for line in text.splitlines():
    if line:
        print(f"::add-mask::{line}")
print(f"key_bytes={len(text.encode())} lines={len(text.splitlines())}")
PY
  chmod 600 "${KEY_FILE}"
  if ! ssh-keygen -y -f "${KEY_FILE}" >/dev/null 2>&1; then
    KEY_META="$(
      KEY_FILE="${KEY_FILE}" python3 - <<'PY'
import os
import subprocess
from pathlib import Path

p = Path(os.environ["KEY_FILE"])
text = p.read_text(encoding="utf-8", errors="replace")
lines = text.splitlines()
err = subprocess.run(
    ["ssh-keygen", "-y", "-f", str(p)],
    capture_output=True,
    text=True,
).stderr.strip().splitlines()
print(f"key_bytes={len(text.encode())} lines={len(lines)}")
print(f"first={lines[0]!r}" if lines else "first=<empty>")
print(f"last={lines[-1]!r}" if lines else "last=<empty>")
print(f"has_BEGIN={'BEGIN' in text} has_END={'END' in text}")
print(f"ssh-keygen_stderr={err[-1] if err else '(none)'}")
PY
    )"
    echo "${KEY_META}"
    echo "::error::SSH-Key in Superadmin ungültig — nicht Contabo. Private Key unter WAHA → Bearbeiten neu einfügen (BEGIN/END-Zeilen behalten)."
    exit 1
  fi
  PUB_FP="$(ssh-keygen -lf "${KEY_FILE}" 2>/dev/null | awk '{print $2}')"
  echo "SSH-Key Fingerprint: ${PUB_FP:-unbekannt}"
}

if [[ "${MODE}" == "per_server" ]]; then
  HOST="$(printf '%s' "${CFG_JSON}" | jq -r '.host')"
  USER="$(printf '%s' "${CFG_JSON}" | jq -r '.user // "root"')"
  PORT="$(printf '%s' "${CFG_JSON}" | jq -r '.port // 22')"
  if [[ -z "${HOST}" ]]; then
    echo "::error::per_server-Config unvollständig (host)."
    exit 1
  fi
  # Private Key nicht über bash $(jq) — trailing newline würde verschwinden.
  CFG_JSON="${CFG_JSON}" KEY_FILE="${KEY_FILE}" python3 - <<'PY'
import base64, json, os, re, subprocess
from pathlib import Path

cfg = json.loads(os.environ["CFG_JSON"])
raw = cfg.get("privateKey") or ""
if not isinstance(raw, str) or not raw.strip():
    raise SystemExit("per_server-Config unvollständig (key).")
text = raw.replace("\r\n", "\n").replace("\r", "\n").replace("\\n", "\n").strip()
if "BEGIN" not in text:
    decoded = base64.b64decode(re.sub(r"\s+", "", text), validate=False).decode("utf-8")
    if "BEGIN" not in decoded or "PRIVATE KEY" not in decoded:
        raise SystemExit("SSH private key ungültig (BEGIN PRIVATE KEY fehlt).")
    text = decoded.strip()
if "BEGIN" not in text or "PRIVATE KEY" not in text:
    raise SystemExit("SSH private key ungültig (BEGIN PRIVATE KEY fehlt).")
if "\n" not in text:
    m_b = re.match(r"^(-----BEGIN [^-]+-----)", text)
    m_e = re.search(r"(-----END [^-]+-----)$", text)
    if m_b and m_e:
        body = text[len(m_b.group(1)) : -len(m_e.group(1))]
        chunks = [body[i : i + 70] for i in range(0, len(body), 70)]
        text = "\n".join([m_b.group(1), *chunks, m_e.group(1)])
text = text.strip() + "\n"
path = Path(os.environ["KEY_FILE"])
path.write_text(text, encoding="utf-8")
path.chmod(0o600)
for line in text.splitlines():
    if line:
        print(f"::add-mask::{line}")
print(f"key_bytes={len(text.encode())} lines={len(text.splitlines())}")
r = subprocess.run(["ssh-keygen", "-y", "-f", str(path)], capture_output=True, text=True)
if r.returncode != 0:
    err = (r.stderr or "").strip().splitlines()
    print(f"first={text.splitlines()[0]!r}")
    print(f"last={text.splitlines()[-1]!r}")
    print(f"ssh-keygen_stderr={err[-1] if err else '(none)'}")
    raise SystemExit(
        "SSH-Key in Superadmin ungültig — nicht Contabo. Private Key unter WAHA → Bearbeiten neu einfügen (BEGIN/END-Zeilen behalten)."
    )
fp = subprocess.run(["ssh-keygen", "-lf", str(path)], capture_output=True, text=True)
print("SSH-Key Fingerprint:", (fp.stdout.split()[1] if fp.stdout.split() else "unbekannt"))
PY
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
