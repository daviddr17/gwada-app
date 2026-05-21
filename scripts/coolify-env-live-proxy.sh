#!/usr/bin/env bash
# Setzt Live-Proxy-Env in der Coolify-App (gwada-app auf Port 3000).
# Voraussetzung: ssh-copy-id root@95.111.229.250
set -euo pipefail

APP_ORIGIN="${APP_ORIGIN:-http://95.111.229.250:3000}"
SUPABASE_UPSTREAM="${SUPABASE_UPSTREAM:-http://95.111.229.250:8001}"
VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"

echo "Suche Container mit Port 3000 auf ${VPS}…"
CONTAINER="$(ssh -o BatchMode=yes "${SSH_USER}@${VPS}" \
  "docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E '0\\.0\\.0\\.0:3000->|:::3000->' | head -1 | cut -f1")"

if [[ -z "${CONTAINER}" ]]; then
  echo "Kein Container mit Host-Port 3000 gefunden." >&2
  ssh "${SSH_USER}@${VPS}" "docker ps --format 'table {{.Names}}\t{{.Ports}}'" >&2 || true
  exit 1
fi

echo "Container: ${CONTAINER}"

# Env-Datei im Container (Coolify/Nixpacks) oder docker update für nächsten Restart
ssh "${SSH_USER}@${VPS}" bash -s -- "${CONTAINER}" "${APP_ORIGIN}" "${SUPABASE_UPSTREAM}" <<'REMOTE'
set -euo pipefail
c="$1"
origin="$2"
upstream="$3"

patch_env() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  grep -v '^NEXT_PUBLIC_SUPABASE_PROXY=' "$f" 2>/dev/null | grep -v '^SUPABASE_UPSTREAM_URL=' | grep -v '^NEXT_PUBLIC_SITE_URL=' | grep -v '^NEXT_PUBLIC_SUPABASE_URL=' > "${f}.tmp" || true
  {
    cat "${f}.tmp" 2>/dev/null || true
    echo "NEXT_PUBLIC_SUPABASE_PROXY=true"
    echo "SUPABASE_UPSTREAM_URL=${upstream}"
    echo "NEXT_PUBLIC_SITE_URL=${origin}"
    echo "NEXT_PUBLIC_SUPABASE_URL=${origin}/sb"
  } > "${f}"
  rm -f "${f}.tmp"
}

# Typische Pfade in Coolify-Deployments
for f in /app/.env /app/.env.production; do
  if docker exec "$c" test -f "$f" 2>/dev/null; then
    echo "Patch $f im laufenden Container…"
    docker exec "$c" sh -c "grep -v '^NEXT_PUBLIC_SUPABASE_PROXY=' '$f' 2>/dev/null | grep -v '^SUPABASE_UPSTREAM_URL=' | grep -v '^NEXT_PUBLIC_SITE_URL=' | grep -v '^NEXT_PUBLIC_SUPABASE_URL=' > '${f}.bak' || true"
    docker exec "$c" sh -c "cat '${f}.bak' 2>/dev/null; echo NEXT_PUBLIC_SUPABASE_PROXY=true; echo SUPABASE_UPSTREAM_URL=${upstream}; echo NEXT_PUBLIC_SITE_URL=${origin}; echo NEXT_PUBLIC_SUPABASE_URL=${origin}/sb" > /tmp/gwada-env-patch
    docker cp /tmp/gwada-env-patch "$c:$f"
    rm -f /tmp/gwada-env-patch
  fi
done

# Runtime-Env für sofortigen Effekt (bis Redeploy)
docker update "$c" \
  -e NEXT_PUBLIC_SUPABASE_PROXY=true \
  -e "SUPABASE_UPSTREAM_URL=${upstream}" \
  -e "NEXT_PUBLIC_SITE_URL=${origin}" \
  -e "NEXT_PUBLIC_SUPABASE_URL=${origin}/sb" >/dev/null

docker restart "$c"
echo "Container neu gestartet mit Proxy-Env."
REMOTE

echo "✓ Coolify-Container ${CONTAINER} aktualisiert (${APP_ORIGIN}/sb → ${SUPABASE_UPSTREAM})"
