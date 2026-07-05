#!/usr/bin/env bash
# Staging new.gwada.app auf dem VPS einrichten (Schritte 2–5 aus docs/new-gwada-app-staging.md).
# Voraussetzungen:
#   1. DNS new.gwada.app → VPS (oder Cloudflare Origin = VPS)
#   2. ssh-copy-id root@95.111.229.250
#   3. .env.production mit Live-Keys (optional für Rebuild)
#
# Nutzung (Repo-Root):
#   bash scripts/bootstrap-new-gwada-app.sh
#   bash scripts/bootstrap-new-gwada-app.sh --skip-firewall
#   bash scripts/bootstrap-new-gwada-app.sh --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

APP_ORIGIN="${APP_ORIGIN:-https://gwada.app}"
VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
VPS_IP="${VPS}"
DOMAIN="${DOMAIN:-gwada.app}"
SKIP_FIREWALL=0
DRY_RUN=0

for arg in "$@"; do
  case "${arg}" in
    --skip-firewall) SKIP_FIREWALL=1 ;;
    --dry-run) DRY_RUN=1 ;;
  esac
done

echo "=== Gwada: Bootstrap ${DOMAIN} ==="

echo ""
echo "→ SSH prüfen…"
if ! gwada_ssh "${SSH_USER}@${VPS}" true; then
  echo "" >&2
  echo "SSH fehlgeschlagen." >&2
  echo "" >&2
  echo "Bitte zuerst manuell testen:" >&2
  echo "  ssh -i ~/.ssh/id_ed25519 root@${VPS}" >&2
  echo "" >&2
  echo "Key-Passphrase für Skripte laden:" >&2
  echo "  ssh-add --apple-use-keychain ~/.ssh/id_ed25519" >&2
  echo "" >&2
  echo "Nur Passwort-Login? Key erneut installieren:" >&2
  echo "  ssh-copy-id -i ~/.ssh/id_ed25519.pub root@${VPS}" >&2
  exit 1
fi
echo "  OK"

echo ""
echo "→ DNS prüfen (${DOMAIN})…"
if ! host "${DOMAIN}" >/dev/null 2>&1; then
  echo "  WARNUNG: ${DOMAIN} hat noch keinen DNS-Eintrag (NXDOMAIN)." >&2
  echo "  Coolify/SSL brauchen die Domain — zuerst bei IONOS/Cloudflare anlegen." >&2
  if [[ "${SKIP_DNS_CHECK:-}" == "1" ]]; then
    echo "  SKIP_DNS_CHECK=1 — weiter ohne DNS."
  else
    echo "  Setze DNS bei IONOS oder: SKIP_DNS_CHECK=1 npm run bootstrap:new-gwada-app" >&2
    exit 1
  fi
else
  resolved="$(host "${DOMAIN}" 2>/dev/null | awk '/has address/{print $4}' | tr '\n' ' ')"
  echo "  Auflösung: ${resolved:-?}"
  if echo " ${resolved} " | grep -q " ${VPS_IP} "; then
    echo "  Zeigt direkt auf VPS-IP — gut."
  else
    echo "  Hinweis: Nicht die VPS-IP (${VPS_IP}). Bei Cloudflare-Proxy ist das normal — Origin muss auf den VPS zeigen."
  fi
fi

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo ""
  echo "[dry-run] Würde ausführen: coolify-env, gotrue, firewall, coolify-domain-hinweis"
  exit 0
fi

echo ""
echo "→ Coolify-App: Proxy-Env (${APP_ORIGIN})…"
APP_ORIGIN="${APP_ORIGIN}" SUPABASE_UPSTREAM="${SUPABASE_UPSTREAM:-http://supabase-kong-oogd5syyxiqb1k4g0wy1u9n8:8000}" \
  LIVE_VPS_HOST="${VPS}" LIVE_SSH_USER="${SSH_USER}" \
  bash "${ROOT}/scripts/coolify-env-live-proxy.sh"

echo ""
echo "→ GoTrue Redirect-URLs…"
bash "${ROOT}/scripts/vps-patch-gotrue-redirects.sh"

if [[ "${SKIP_FIREWALL}" -eq 0 ]]; then
  echo ""
  echo "→ Firewall (Studio/Postgres/Kong nach außen)…"
  bash "${ROOT}/scripts/vps-harden-public-db-ports.sh"
else
  echo ""
  echo "→ Firewall übersprungen (--skip-firewall)"
fi

echo ""
echo "→ Coolify-Domain / SSL (manuell in UI, falls noch nicht gesetzt)…"
gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${DOMAIN}" <<'REMOTE'
set -euo pipefail
domain="$1"
compose_glob="/data/coolify/applications/*/docker-compose.yaml"
if compgen -G "$compose_glob" >/dev/null; then
  echo "  Coolify-Apps unter /data/coolify/applications/:"
  ls -1 /data/coolify/applications/ 2>/dev/null | head -5 || true
fi
echo ""
echo "  In Coolify UI für die gwada-app:"
echo "    • Domain/FQDN: ${domain}"
echo "    • HTTPS / Let's Encrypt aktivieren"
echo "    • Nach DNS-Propagation neu deployen (git push main oder Redeploy-Button)"
REMOTE

echo ""
echo "=== Bootstrap-Skript fertig ==="
echo ""
echo "Nächste Schritte:"
echo "  1. Coolify: Domain ${DOMAIN} + SSL (falls noch offen)"
echo "  2. git push main → Coolify-Build (NEXT_PUBLIC_* aus Coolify Build-Env)"
echo "  3. Schema: npm run deploy:live"
echo "  4. Test: ${APP_ORIGIN} — Login, Speisekarte, /sb"
echo ""
echo "Siehe docs/new-gwada-app-staging.md"
