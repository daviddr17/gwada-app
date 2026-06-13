#!/usr/bin/env bash
# CRON_SECRET in Coolify-.env auf dem VPS setzen und App-Container neu starten.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "CRON_SECRET fehlt (GitHub Secret oder Umgebung)." >&2
  exit 1
fi

if ! gwada_ssh "${SSH_USER}@${VPS}" true; then
  echo "SSH fehlgeschlagen (${SSH_USER}@${VPS})." >&2
  exit 1
fi

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${CRON_SECRET@Q}" <<'REMOTE'
set -euo pipefail
secret="$1"
app_id="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
compose_dir="/data/coolify/applications/${app_id}"

if [[ ! -d "${compose_dir}" ]]; then
  echo "Coolify-Verzeichnis fehlt: ${compose_dir}" >&2
  exit 1
fi

patch_env() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  grep -v '^CRON_SECRET=' "$f" > "${f}.tmp" || true
  printf 'CRON_SECRET=%s\n' "$secret" >> "${f}.tmp"
  mv "${f}.tmp" "$f"
  echo "  CRON_SECRET gesetzt in ${f}"
}

for f in "${compose_dir}/.env" "${compose_dir}/.env.production"; do
  patch_env "$f"
done

cd "${compose_dir}"
docker compose up -d --force-recreate --remove-orphans
echo "✓ App neu gestartet mit CRON_SECRET"
REMOTE

echo "✓ CRON_SECRET auf VPS synchronisiert"
