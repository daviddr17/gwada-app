#!/usr/bin/env bash
# Domain-Cutover auf dem VPS:
#   gwada.app      → Next.js (Coolify)
#   old.gwada.app  → Bubble (DNS bei IONOS, nicht in diesem Skript)
#   new.gwada.app  → optional 301 → gwada.app (scripts/vps-traefik-redirect-new-to-gwada.sh)
#
# Voraussetzung: DNS gwada.app → VPS-IP, ssh-copy-id root@95.111.229.250
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_ORIGIN="${APP_ORIGIN:-https://gwada.app}"
COOLIFY_FQDN="${COOLIFY_FQDN:-gwada.app}"
LEGACY_STAGING_ORIGIN="${GWADA_LEGACY_STAGING_ORIGIN:-https://new.gwada.app}"

echo "=== Gwada Domain-Cutover ==="
echo "  App:     ${APP_ORIGIN}"
echo "  Traefik: ${COOLIFY_FQDN}"
echo "  Legacy:  ${LEGACY_STAGING_ORIGIN} (GoTrue allow list)"
echo ""

echo "→ 1/4 Coolify Env (SITE_URL + /sb)"
APP_ORIGIN="${APP_ORIGIN}" bash scripts/coolify-env-live-proxy.sh

echo ""
echo "→ 2/4 Traefik Host-Rule"
COOLIFY_FQDN="${COOLIFY_FQDN}" bash scripts/vps-ensure-coolify-traefik-fqdn.sh

echo ""
echo "→ 3/4 GoTrue Redirects"
APP_ORIGIN="${APP_ORIGIN}" \
  GWADA_LEGACY_STAGING_ORIGIN="${LEGACY_STAGING_ORIGIN}" \
  bash scripts/vps-patch-gotrue-redirects.sh

echo ""
echo "→ 4/4 DNS-Checkliste (manuell bei IONOS / Cloudflare)"
cat <<EOF
  [ ] old.gwada.app     → A/CNAME Bubble
  [ ] gwada.app         → A ${LIVE_VPS_HOST:-95.111.229.250}
  [ ] Optional: new.gwada.app → 301 gwada.app:
        bash scripts/vps-traefik-redirect-new-to-gwada.sh

  Danach App neu bauen (NEXT_PUBLIC_*):
    gh workflow run deploy-live-app.yml --ref main
    gh run watch --workflow=deploy-live-app.yml --exit-status

  Verifikation:
    curl -s ${APP_ORIGIN}/api/build-info
EOF

echo ""
echo "✓ VPS-Cutover-Schritte abgeschlossen (DNS + App-Deploy noch prüfen)."
