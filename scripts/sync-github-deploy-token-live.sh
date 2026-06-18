#!/usr/bin/env bash
# GITHUB_DEPLOY_TOKEN in Coolify-.env + compose durchreichen, Container neu starten.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"
# shellcheck source=scripts/ensure-coolify-compose-runtime-env.sh
source "${ROOT}/scripts/ensure-coolify-compose-runtime-env.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"

if [[ -z "${GITHUB_DEPLOY_TOKEN:-}" ]]; then
  echo "GITHUB_DEPLOY_TOKEN fehlt (GitHub Secret GWADA_GITHUB_DEPLOY_TOKEN)." >&2
  exit 1
fi

if ! gwada_ssh "${SSH_USER}@${VPS}" true; then
  echo "SSH fehlgeschlagen (${SSH_USER}@${VPS})." >&2
  exit 1
fi

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${GITHUB_DEPLOY_TOKEN@Q}" <<'REMOTE'
set -euo pipefail
token="$1"
app_id="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
compose_dir="/data/coolify/applications/${app_id}"

if [[ ! -d "${compose_dir}" ]]; then
  echo "Coolify-Verzeichnis fehlt: ${compose_dir}" >&2
  exit 1
fi

patch_env() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  grep -v '^GITHUB_DEPLOY_TOKEN=' "$f" > "${f}.tmp" || true
  printf 'GITHUB_DEPLOY_TOKEN=%s\n' "$token" >> "${f}.tmp"
  mv "${f}.tmp" "$f"
  echo "  GITHUB_DEPLOY_TOKEN gesetzt in ${f}"
}

for f in "${compose_dir}/.env" "${compose_dir}/.env.production"; do
  patch_env "$f"
done

python3 - "${compose_dir}/docker-compose.yaml" "GITHUB_DEPLOY_TOKEN" <<'PY'
import re
import sys
from pathlib import Path

compose = Path(sys.argv[1])
if not compose.is_file():
    compose = Path(sys.argv[1].replace("docker-compose.yaml", "docker-compose.yml"))
text = compose.read_text()
key = sys.argv[2]
ref_line = f"- {key}=${{{key}}}"
if not re.search(rf"^\s*-\s*{re.escape(key)}=", text, re.M):
    env_block = re.search(r"^(\s+)environment:\s*$", text, re.M)
    if env_block:
        indent = env_block.group(1) + "  "
        text = text[: env_block.end()] + f"{indent}{ref_line}\n" + text[env_block.end() :]
        print(f"compose: {key} unter environment ergänzt")
    else:
        print(f"WARNUNG: environment-Block fehlt in {compose}", file=sys.stderr)
compose.write_text(text)
PY

cd "${compose_dir}"
docker compose up -d --force-recreate --remove-orphans

running="$(docker ps --format '{{.Names}}' | grep "${app_id}-" | head -1 || true)"
if [[ -n "${running}" ]] && docker exec "${running}" printenv GITHUB_DEPLOY_TOKEN 2>/dev/null | grep -q .; then
  echo "✓ GITHUB_DEPLOY_TOKEN im Container aktiv"
else
  echo "WARNUNG: GITHUB_DEPLOY_TOKEN nach Recreate nicht im Container" >&2
  exit 1
fi
REMOTE

echo "✓ GITHUB_DEPLOY_TOKEN auf VPS synchronisiert"
