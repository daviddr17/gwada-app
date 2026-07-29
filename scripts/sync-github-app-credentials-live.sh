#!/usr/bin/env bash
# GitHub App Credentials in Coolify-.env + compose durchreichen, Container neu starten.
# Tokens mintet die Live-App danach selbst — kein ablaufender PAT nötig.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"
# shellcheck source=scripts/ensure-coolify-compose-runtime-env.sh
source "${ROOT}/scripts/ensure-coolify-compose-runtime-env.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"

APP_ID="${GITHUB_APP_ID:-${GWADA_GITHUB_APP_ID:-}}"
INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GWADA_GITHUB_APP_INSTALLATION_ID:-}}"
PRIVATE_KEY_RAW="${GITHUB_APP_PRIVATE_KEY:-${GWADA_GITHUB_APP_PRIVATE_KEY:-}}"

if [[ -z "${APP_ID}" || -z "${INSTALLATION_ID}" || -z "${PRIVATE_KEY_RAW}" ]]; then
  echo "GITHUB_APP_ID / GITHUB_APP_INSTALLATION_ID / GITHUB_APP_PRIVATE_KEY fehlen." >&2
  echo "GitHub Secrets: GWADA_GITHUB_APP_ID, GWADA_GITHUB_APP_INSTALLATION_ID, GWADA_GITHUB_APP_PRIVATE_KEY" >&2
  exit 1
fi

# Private Key als Base64 speichern (mehrzeilig-sicher in .env).
PRIVATE_KEY_B64="$(
  PRIVATE_KEY_RAW="${PRIVATE_KEY_RAW}" python3 - <<'PY'
import base64
import os

raw = os.environ["PRIVATE_KEY_RAW"]
text = raw
if "BEGIN" not in text:
    try:
        decoded = base64.b64decode(
            text.replace("\n", "").replace(" ", ""),
            validate=False,
        ).decode("utf-8")
        if "BEGIN" in decoded:
            text = decoded
    except Exception:
        pass
text = text.replace("\\n", "\n").strip() + "\n"
print(base64.b64encode(text.encode("utf-8")).decode("ascii"), end="")
PY
)"

if ! gwada_ssh "${SSH_USER}@${VPS}" true; then
  echo "SSH fehlgeschlagen (${SSH_USER}@${VPS})." >&2
  exit 1
fi

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- \
  "${APP_ID}" \
  "${INSTALLATION_ID}" \
  "${PRIVATE_KEY_B64}" <<'REMOTE'
set -euo pipefail
app_id="$1"
installation_id="$2"
private_key_b64="$3"
coolify_app_id="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
compose_dir="/data/coolify/applications/${coolify_app_id}"

if [[ ! -d "${compose_dir}" ]]; then
  echo "Coolify-Verzeichnis fehlt: ${compose_dir}" >&2
  exit 1
fi

patch_env() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  grep -vE '^(GITHUB_APP_ID|GITHUB_APP_INSTALLATION_ID|GITHUB_APP_PRIVATE_KEY)=' "$f" > "${f}.tmp" || true
  {
    printf 'GITHUB_APP_ID=%s\n' "${app_id}"
    printf 'GITHUB_APP_INSTALLATION_ID=%s\n' "${installation_id}"
    printf 'GITHUB_APP_PRIVATE_KEY=%s\n' "${private_key_b64}"
  } >> "${f}.tmp"
  mv "${f}.tmp" "$f"
  echo "  GitHub App Credentials gesetzt in ${f}"
}

for f in "${compose_dir}/.env" "${compose_dir}/.env.production"; do
  patch_env "$f"
done

python3 - "${compose_dir}/docker-compose.yaml" <<'PY'
import re
import sys
from pathlib import Path

compose = Path(sys.argv[1])
if not compose.is_file():
    compose = Path(str(compose).replace("docker-compose.yaml", "docker-compose.yml"))
text = compose.read_text()
keys = [
    "GITHUB_APP_ID",
    "GITHUB_APP_INSTALLATION_ID",
    "GITHUB_APP_PRIVATE_KEY",
]
changed = False
for key in keys:
    ref_line = f"- {key}=${{{key}}}"
    if re.search(rf"^\s*-\s*{re.escape(key)}=", text, re.M):
        continue
    env_block = re.search(r"^(\s+)environment:\s*$", text, re.M)
    if not env_block:
        print(f"WARNUNG: environment-Block fehlt in {compose}", file=sys.stderr)
        break
    indent = env_block.group(1) + "  "
    text = text[: env_block.end()] + f"{indent}{ref_line}\n" + text[env_block.end() :]
    print(f"compose: {key} unter environment ergänzt")
    changed = True
if changed:
    compose.write_text(text)
PY

cd "${compose_dir}"
docker compose up -d --force-recreate --remove-orphans

running="$(docker ps --format '{{.Names}}' | grep "${coolify_app_id}-" | head -1 || true)"
if [[ -n "${running}" ]] \
  && docker exec "${running}" printenv GITHUB_APP_ID 2>/dev/null | grep -q . \
  && docker exec "${running}" printenv GITHUB_APP_INSTALLATION_ID 2>/dev/null | grep -q . \
  && docker exec "${running}" printenv GITHUB_APP_PRIVATE_KEY 2>/dev/null | grep -q .; then
  echo "✓ GitHub App Credentials im Container aktiv"
else
  echo "WARNUNG: GitHub App Credentials nach Recreate nicht im Container" >&2
  exit 1
fi
REMOTE

echo "✓ GitHub App Credentials auf VPS synchronisiert"
