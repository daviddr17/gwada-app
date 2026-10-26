#!/usr/bin/env bash
# Läuft auf dem VPS (von vps-cutover-coolify-to-caddy.sh hochgeladen).
set -euo pipefail

LIVE_DIR="${GWADA_LIVE_COMPOSE_DIR:-/opt/gwada/live}"
APP_ID="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
SUPABASE_NET="${GWADA_SUPABASE_DOCKER_NETWORK:-oogd5syyxiqb1k4g0wy1u9n8}"
STAGING="${GWADA_CUTOVER_STAGING:-}"
COOLIFY_APP_DIR="/data/coolify/applications/${APP_ID}"
APP_ORIGIN="${APP_ORIGIN:-https://gwada.app}"

if [[ -z "${STAGING}" || ! -d "${STAGING}" ]]; then
  echo "GWADA_CUTOVER_STAGING fehlt." >&2
  exit 1
fi

echo "=== Cutover remote $(date -Is) → ${LIVE_DIR} ==="

mkdir -p "${LIVE_DIR}"
cp -a "${STAGING}/docker-compose.yml" "${LIVE_DIR}/docker-compose.yml"
cp -a "${STAGING}/Caddyfile" "${LIVE_DIR}/Caddyfile"

# .env aus Coolify übernehmen (einmalig / wenn noch nicht vorhanden)
if [[ ! -f "${LIVE_DIR}/.env" ]]; then
  if [[ ! -f "${COOLIFY_APP_DIR}/.env" ]]; then
    echo "Weder ${LIVE_DIR}/.env noch Coolify-.env — Abbruch." >&2
    exit 1
  fi
  cp -a "${COOLIFY_APP_DIR}/.env" "${LIVE_DIR}/.env"
  chmod 600 "${LIVE_DIR}/.env"
  echo "Coolify-.env → ${LIVE_DIR}/.env kopiert."
else
  echo "Bestehende ${LIVE_DIR}/.env belassen."
fi

# Aktuelles Image aus laufendem Coolify-App-Container oder Compose
CURRENT_IMAGE=""
RUNNING="$(docker ps --format '{{.Names}}\t{{.Image}}' | grep "${APP_ID}-" | head -1 || true)"
if [[ -n "${RUNNING}" ]]; then
  CURRENT_IMAGE="$(echo "${RUNNING}" | awk '{print $2}')"
fi
if [[ -z "${CURRENT_IMAGE}" ]]; then
  for f in "${COOLIFY_APP_DIR}/docker-compose.yaml" "${COOLIFY_APP_DIR}/docker-compose.yml"; do
    [[ -f "$f" ]] || continue
    CURRENT_IMAGE="$(grep -E "^\s*image:" "$f" | head -1 | sed -E "s/.*image:[[:space:]]*['\"]?([^'\"]+)['\"]?/\1/")"
    break
  done
fi
if [[ -z "${CURRENT_IMAGE}" ]]; then
  # Fallback: build-info SHA
  SHA="$(curl -fsS "${APP_ORIGIN}/api/build-info" 2>/dev/null | sed -n 's/.*"sha":"\([^"]*\)".*/\1/p' || true)"
  if [[ -n "${SHA}" ]]; then
    CURRENT_IMAGE="ghcr.io/daviddr17/gwada-app:${SHA}"
  fi
fi
if [[ -z "${CURRENT_IMAGE}" ]]; then
  echo "Konnte aktuelles App-Image nicht ermitteln." >&2
  exit 1
fi
echo "App-Image: ${CURRENT_IMAGE}"

# GWADA_APP_IMAGE in .env setzen/ersetzen
if grep -q '^GWADA_APP_IMAGE=' "${LIVE_DIR}/.env"; then
  grep -v '^GWADA_APP_IMAGE=' "${LIVE_DIR}/.env" > "${LIVE_DIR}/.env.tmp"
  mv "${LIVE_DIR}/.env.tmp" "${LIVE_DIR}/.env"
fi
printf 'GWADA_APP_IMAGE=%s\n' "${CURRENT_IMAGE}" >> "${LIVE_DIR}/.env"
if ! grep -q '^GWADA_SUPABASE_DOCKER_NETWORK=' "${LIVE_DIR}/.env"; then
  printf 'GWADA_SUPABASE_DOCKER_NETWORK=%s\n' "${SUPABASE_NET}" >> "${LIVE_DIR}/.env"
fi

if ! docker network inspect "${SUPABASE_NET}" >/dev/null 2>&1; then
  echo "Supabase-Netz ${SUPABASE_NET} fehlt — Abbruch." >&2
  exit 1
fi
if ! docker network inspect coolify >/dev/null 2>&1; then
  echo "WARNUNG: Netz coolify fehlt — Authelia ggf. unerreichbar." >&2
fi

# Traefik / Coolify-Proxy stoppen (Ports 80/443)
stop_proxy() {
  local name
  for name in coolify-proxy coolify-traefik traefik; do
    if docker ps --format '{{.Names}}' | grep -qx "${name}"; then
      echo "Stoppe Proxy-Container ${name} …"
      docker stop "${name}" || true
    fi
  done
  # Coolify source compose oft „proxy“ service
  if [[ -d /data/coolify/source ]]; then
    (cd /data/coolify/source && docker compose stop proxy 2>/dev/null) || true
  fi
  if [[ -d /data/coolify/proxy ]]; then
    (cd /data/coolify/proxy && docker compose stop 2>/dev/null) || true
  fi
}

# Alte Coolify-App stoppen (nicht Supabase)
stop_coolify_app() {
  if [[ -d "${COOLIFY_APP_DIR}" ]]; then
    echo "Stoppe Coolify-App Compose …"
    (cd "${COOLIFY_APP_DIR}" && docker compose stop 2>/dev/null) || true
  fi
  local c
  while read -r c; do
    [[ -n "$c" ]] || continue
    docker stop "$c" 2>/dev/null || true
  done < <(docker ps --format '{{.Names}}' | grep "${APP_ID}-" || true)
}

stop_proxy
stop_coolify_app

# Kurz warten bis Ports frei
sleep 2

cd "${LIVE_DIR}"
# shellcheck disable=SC1091
set -a
# shellcheck disable=SC1090
source "${LIVE_DIR}/.env"
set +a
export GWADA_APP_IMAGE="${CURRENT_IMAGE}"

echo "docker compose up -d …"
docker compose pull app || true
docker compose up -d

echo "Warte auf build-info …"
for i in $(seq 1 60); do
  if curl -fsS "${APP_ORIGIN}/api/build-info" >/tmp/gwada-build-info.json 2>/dev/null; then
    echo "build-info: $(cat /tmp/gwada-build-info.json)"
    break
  fi
  sleep 3
done

docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -iE 'gwada|caddy|supabase|authelia' || true
echo "=== CUTOVER_REMOTE_OK $(date -Is) ==="
