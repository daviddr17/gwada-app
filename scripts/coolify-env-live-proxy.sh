#!/usr/bin/env bash
# Setzt Live-Proxy-Env in der Coolify-App (gwada-app auf Port 3000).
# Voraussetzung: ssh-copy-id root@95.111.229.250
set -euo pipefail

APP_ORIGIN="${APP_ORIGIN:-https://new.gwada.app}"
SUPABASE_UPSTREAM="${SUPABASE_UPSTREAM:-http://supabase-kong-oogd5syyxiqb1k4g0wy1u9n8:8000}"
VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"

# shellcheck source=scripts/gwada-ssh-lib.sh
source "$(dirname "$0")/gwada-ssh-lib.sh"

echo "Suche Container mit Port 3000 auf ${VPS}…"
CONTAINER="$(gwada_ssh "${SSH_USER}@${VPS}" \
  "docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E '0\\.0\\.0\\.0:3000->|:::3000->' | head -1 | cut -f1")"

if [[ -z "${CONTAINER}" ]]; then
  echo "Kein Container mit Host-Port 3000 gefunden." >&2
  gwada_ssh "${SSH_USER}@${VPS}" "docker ps --format 'table {{.Names}}\t{{.Ports}}'" >&2 || true
  exit 1
fi

echo "Container: ${CONTAINER}"

# Coolify-Compose-.env auf dem Host + optional /app/.env im Container; dann neu starten.
# Hinweis: docker update unterstützt keine -e Env-Flags (nur docker run/create).
gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${CONTAINER}" "${APP_ORIGIN}" "${SUPABASE_UPSTREAM}" <<'REMOTE'
set -euo pipefail
c="$1"
origin="$2"
upstream="$3"

patch_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  grep -v '^NEXT_PUBLIC_SUPABASE_PROXY=' "$f" 2>/dev/null \
    | grep -v '^SUPABASE_UPSTREAM_URL=' \
    | grep -v '^NEXT_PUBLIC_SITE_URL=' \
    | grep -v '^NEXT_PUBLIC_SUPABASE_URL=' \
    | grep -v '^NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=' \
    | grep -v '^NEXT_PUBLIC_GWADA_SUPABASE_ONLY=' > "${f}.tmp" || true
  {
    cat "${f}.tmp" 2>/dev/null || true
    echo "NEXT_PUBLIC_SUPABASE_PROXY=true"
    echo "SUPABASE_UPSTREAM_URL=${upstream}"
    echo "NEXT_PUBLIC_SITE_URL=${origin}"
    echo "NEXT_PUBLIC_SUPABASE_URL=${origin}/sb"
    echo "NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo"
    echo "NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false"
  } > "${f}"
  rm -f "${f}.tmp"
  echo "  .env aktualisiert: ${f}"
}

app_id="${c%%-*}"
compose_dir="/data/coolify/applications/${app_id}"
patched_host=0

if [[ -d "${compose_dir}" ]]; then
  for f in "${compose_dir}/.env" "${compose_dir}/.env.production"; do
    patch_env_file "$f"
    patched_host=1
  done
  if [[ "${patched_host}" -eq 1 ]]; then
    echo "  ✓ Coolify .env gespeichert (wirksam nach Redeploy in Coolify / git push main)."
    echo "  Kein compose recreate — vermeidet fehlende Image-Tags; laufender Container unverändert."
  fi
else
  echo "  Kein Coolify-Verzeichnis ${compose_dir} — Container-Patch."
  for f in /app/.env /app/.env.production; do
    if docker exec "$c" test -f "$f" 2>/dev/null; then
      echo "  Patch ${f} im laufenden Container…"
      docker exec "$c" sh -c "grep -v '^NEXT_PUBLIC_SUPABASE_PROXY=' '$f' 2>/dev/null | grep -v '^SUPABASE_UPSTREAM_URL=' | grep -v '^NEXT_PUBLIC_SITE_URL=' | grep -v '^NEXT_PUBLIC_SUPABASE_URL=' | grep -v '^NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=' | grep -v '^NEXT_PUBLIC_GWADA_SUPABASE_ONLY=' > '${f}.bak' || true"
      docker exec "$c" sh -c "cat '${f}.bak' 2>/dev/null; echo NEXT_PUBLIC_SUPABASE_PROXY=true; echo SUPABASE_UPSTREAM_URL=${upstream}; echo NEXT_PUBLIC_SITE_URL=${origin}; echo NEXT_PUBLIC_SUPABASE_URL=${origin}/sb; echo NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo; echo NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false" > /tmp/gwada-env-patch
      docker cp /tmp/gwada-env-patch "$c:$f"
      rm -f /tmp/gwada-env-patch
    fi
  done
  docker restart "$c"
  echo "  Container neu gestartet (Fallback ohne Coolify-Verzeichnis)."
fi

echo "  ✓ Proxy-Env: ${origin}/sb → ${upstream}"
REMOTE

echo "✓ Coolify-Container ${CONTAINER} aktualisiert (${APP_ORIGIN}/sb → ${SUPABASE_UPSTREAM})"
