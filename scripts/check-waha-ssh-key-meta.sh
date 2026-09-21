#!/usr/bin/env bash
# Check WAHA SSH private key meta via live API (no key content in logs beyond prefixes).
set -euo pipefail

if [ -z "${LIVE_SSH_KEY:-}" ] || [ -z "${LIVE_VPS_HOST:-}" ] || [ -z "${CRON_SECRET:-}" ]; then
  echo "::error::LIVE_SSH or CRON_SECRET missing"
  exit 1
fi

mkdir -p ~/.ssh
printf '%s\n' "${LIVE_SSH_KEY}" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keyscan -H "${LIVE_VPS_HOST}" >> ~/.ssh/known_hosts 2>/dev/null || true

CFG=$(curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" \
  "https://gwada.app/api/internal/waha-ssh-config?server_id=9c0adba8-eaa0-4087-ae77-820fc2502588")
echo "$CFG" | jq '{ok, mode, host, user, port, containerName, keyLen:(.privateKey|length), begin:(.privateKey|.[0:40]), hasBegin:(.privateKey|contains("BEGIN")), hasEscaped:(.privateKey|contains("\\n")), newlines:(.privateKey|split("\n")|length)}'
echo "$CFG" | jq -r '.privateKey' > /tmp/k

python3 - <<'PY'
import pathlib
text = pathlib.Path("/tmp/k").read_text().replace("\r\n", "\n").replace("\r", "\n")
text = text.replace("\\n", "\n").strip() + "\n"
pathlib.Path("/tmp/k2").write_text(text)
print("normalized_len", len(text), "lines", len(text.splitlines()))
print("first", text.splitlines()[0])
print("last", text.splitlines()[-1])
PY

ssh-keygen -y -f /tmp/k2 >/tmp/pub 2>/tmp/err && echo "keygen_ok" || (echo "keygen_fail"; cat /tmp/err; exit 1)
