#!/usr/bin/env bash
# Mac/CI: Domain-Cutover auf dem VPS (Coolify-Env, Traefik-FQDN, GoTrue, optional new→301).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
APP_ORIGIN="${APP_ORIGIN:-https://gwada.app}"
COOLIFY_FQDN="${COOLIFY_FQDN:-gwada.app}"
REDIRECT_NEW=0

for arg in "$@"; do
  case "${arg}" in
    --redirect-new) REDIRECT_NEW=1 ;;
  esac
done

echo "=== Domain-Cutover (${SSH_USER}@${VPS}) ==="
echo "  App:     ${APP_ORIGIN}"
echo "  Traefik: ${COOLIFY_FQDN}"
echo ""

if ! gwada_ssh "${SSH_USER}@${VPS}" true; then
  echo "SSH fehlgeschlagen. Einmalig: ssh-copy-id ${SSH_USER}@${VPS}" >&2
  exit 1
fi

echo "→ 1/3 Coolify Env (SITE_URL + /sb)"
APP_ORIGIN="${APP_ORIGIN}" bash "${ROOT}/scripts/coolify-env-live-proxy.sh"

echo ""
echo "→ 2/3 Traefik Host-Rule (${COOLIFY_FQDN})"
gwada_ssh "${SSH_USER}@${VPS}" "COOLIFY_FQDN=$(printf '%q' "${COOLIFY_FQDN}") bash -s" \
  < "${ROOT}/scripts/vps-ensure-coolify-traefik-fqdn.sh"

echo ""
echo "→ 3/3 GoTrue Redirects"
APP_ORIGIN="${APP_ORIGIN}" bash "${ROOT}/scripts/vps-patch-gotrue-redirects.sh"

if [[ "${REDIRECT_NEW}" -eq 1 ]]; then
  echo ""
  echo "→ Optional: new.gwada.app → 301 ${APP_ORIGIN}"
  bash "${ROOT}/scripts/vps-traefik-redirect-new-to-gwada.sh"
fi

echo ""
echo "✓ VPS-Cutover abgeschlossen. App neu deployen: gh workflow run deploy-live-app.yml --ref main"
