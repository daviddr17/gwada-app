#!/usr/bin/env bash
# Entfernt Coolify-Control-Plane vollständig (Container, Images, Volumes, source/proxy/applications).
# Behält: /opt/gwada/live (Caddy+App), Live-Supabase, Authelia, Docker-Netz "coolify", Dev-DB.
# Voraussetzung: Cutover + Stop bereits grün.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
LIVE_DIR="${GWADA_LIVE_COMPOSE_DIR:-/opt/gwada/live}"
APP_ID="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
SUPABASE_SVC="${GWADA_SUPABASE_SERVICE_UUID:-oogd5syyxiqb1k4g0wy1u9n8}"

if [[ "${GWADA_CONFIRM_PRUNE_COOLIFY:-}" != "PRUNE" ]]; then
  echo "Abbruch: setze GWADA_CONFIRM_PRUNE_COOLIFY=PRUNE" >&2
  exit 1
fi

echo "→ Prune Coolify control plane on ${SSH_USER}@${VPS}"

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${LIVE_DIR}" "${APP_ID}" "${SUPABASE_SVC}" <<'REMOTE'
set -euo pipefail
LIVE_DIR="$1"
APP_ID="$2"
SUPABASE_SVC="$3"

log() { printf '%s\n' "$*"; }

# --- Guards: Live over Caddy must be healthy ---
if [[ ! -f "${LIVE_DIR}/docker-compose.yml" ]]; then
  echo "Cutover-Compose fehlt (${LIVE_DIR}) — Abbruch." >&2
  exit 1
fi
if [[ ! -f "${LIVE_DIR}/.env" ]]; then
  echo "Live-.env fehlt (${LIVE_DIR}/.env) — Abbruch (kein Env-Backup)." >&2
  exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -qx gwada-caddy; then
  echo "gwada-caddy läuft nicht — Abbruch." >&2
  exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -qx gwada-app; then
  echo "gwada-app läuft nicht — Abbruch." >&2
  exit 1
fi
BUILD_INFO="$(curl -fsS https://gwada.app/api/build-info || true)"
if [[ -z "${BUILD_INFO}" ]]; then
  echo "build-info unerreichbar — Abbruch." >&2
  exit 1
fi
log "Preflight build-info: ${BUILD_INFO}"

# Supabase + Authelia paths must still exist (never delete these)
if [[ ! -d "/data/coolify/services/${SUPABASE_SVC}" ]]; then
  echo "Live-Supabase-Service-Pfad fehlt — Abbruch (unerwarteter Zustand)." >&2
  exit 1
fi
if [[ ! -d /data/coolify/services/authelia-gwada ]]; then
  echo "Authelia-Pfad fehlt — Abbruch." >&2
  exit 1
fi
if ! docker network inspect coolify >/dev/null 2>&1; then
  echo "Docker-Netz coolify fehlt — Abbruch (Caddy↔Authelia)." >&2
  exit 1
fi

# Running supabase / authelia / live must stay up
for must in \
  "supabase-db-${SUPABASE_SVC}" \
  "supabase-kong-${SUPABASE_SVC}" \
  authelia-gwada \
  gwada-caddy \
  gwada-app
do
  if ! docker ps --format '{{.Names}}' | grep -qx "${must}"; then
    echo "Pflicht-Container nicht running: ${must} — Abbruch." >&2
    exit 1
  fi
done

log "=== Preflight OK — entferne Coolify Control-Plane ==="

# --- 1) Stop + remove Coolify control-plane containers (allowlist) ---
CP_NAMES=(
  coolify
  coolify-realtime
  coolify-redis
  coolify-db
  coolify-proxy
  coolify-traefik
  traefik
)
for name in "${CP_NAMES[@]}"; do
  if docker ps -a --format '{{.Names}}' | grep -qx "${name}"; then
    log "Remove container ${name}"
    docker stop "${name}" >/dev/null 2>&1 || true
    docker rm -f "${name}" >/dev/null 2>&1 || true
  fi
done

# Legacy Coolify-managed app container (replaced by gwada-app) — never touch gwada-*
while read -r c; do
  [[ -n "$c" ]] || continue
  case "$c" in
    gwada-*) log "SKIP legacy match (gwada): $c"; continue ;;
  esac
  log "Remove legacy Coolify app container ${c}"
  docker stop "$c" >/dev/null 2>&1 || true
  docker rm -f "$c" >/dev/null 2>&1 || true
done < <(docker ps -a --format '{{.Names}}' | grep -E "^${APP_ID}-" || true)

# Extra coolify-* containers if any (still allowlist prefix; never supabase/authelia/gwada)
while read -r c; do
  [[ -n "$c" ]] || continue
  case "$c" in
    coolify|coolify-*|coolify_*)
      log "Remove extra coolify container ${c}"
      docker stop "$c" >/dev/null 2>&1 || true
      docker rm -f "$c" >/dev/null 2>&1 || true
      ;;
  esac
done < <(docker ps -a --format '{{.Names}}' | grep -iE '^coolify' || true)

# --- 2) Coolify images (explicit repos only) ---
while read -r img; do
  [[ -n "$img" ]] || continue
  log "Remove image ${img}"
  docker rmi -f "$img" >/dev/null 2>&1 || true
done < <(
  docker images --format '{{.Repository}}:{{.Tag}}' \
    | grep -E '^(ghcr\.io/coollabsio/coolify|ghcr\.io/coollabsio/coolify-helper|ghcr\.io/coollabsio/coolify-realtime)(:|$)' \
    || true
)

# Traefik image only if no remaining container uses it
if ! docker ps -a --format '{{.Image}}' | grep -qiE '^traefik(:|$)'; then
  while read -r img; do
    [[ -n "$img" ]] || continue
    log "Remove unused Traefik image ${img}"
    docker rmi -f "$img" >/dev/null 2>&1 || true
  done < <(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^traefik:' || true)
fi

# --- 3) Coolify volumes (name allowlist; never caddy_*, never supabase) ---
while read -r vol; do
  [[ -n "$vol" ]] || continue
  case "$vol" in
    *caddy*|*supabase*|*gwada*|*postgres*|*authelia*)
      log "SKIP volume (protected pattern): ${vol}"
      continue
      ;;
    coolify|coolify-*|*coolify*)
      log "Remove volume ${vol}"
      docker volume rm -f "${vol}" >/dev/null 2>&1 || true
      ;;
  esac
done < <(docker volume ls --format '{{.Name}}' | grep -i coolify || true)

# --- 4) Install paths: source / proxy / applications only ---
# NEVER: /data/coolify/services, /opt/gwada/live, /opt/gwada-supabase-dev
for path in \
  /data/coolify/source \
  /data/coolify/proxy \
  "/data/coolify/applications/${APP_ID}" \
  /data/coolify/applications
do
  if [[ -e "${path}" ]]; then
    # applications dir: only remove if empty or only our APP_ID left
    if [[ "${path}" == /data/coolify/applications ]]; then
      if [[ -d "${path}" ]]; then
        leftovers="$(find "${path}" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l | tr -d ' ')"
        if [[ "${leftovers}" != "0" ]]; then
          log "WARN: /data/coolify/applications not empty after APP_ID remove — listing:"
          ls -la "${path}" || true
          continue
        fi
      fi
    fi
    log "Remove path ${path}"
    rm -rf "${path}"
  fi
done

# Optional Coolify-only dirs if present and empty of services
for path in \
  /data/coolify/databases \
  /data/coolify/backups \
  /data/coolify/sentinel \
  /data/coolify/ssh \
  /data/coolify/ssl
do
  if [[ -d "${path}" ]]; then
    log "Remove Coolify aux path ${path}"
    rm -rf "${path}"
  fi
done

# Ensure protected paths still exist
if [[ ! -d "/data/coolify/services/${SUPABASE_SVC}" ]] || [[ ! -d /data/coolify/services/authelia-gwada ]]; then
  echo "FATAL: protected service path missing after prune — investigate immediately." >&2
  exit 2
fi
if [[ ! -d "${LIVE_DIR}" ]] || [[ ! -f "${LIVE_DIR}/.env" ]]; then
  echo "FATAL: /opt/gwada/live damaged — investigate immediately." >&2
  exit 2
fi

log "=== Post-prune status ==="
log "--- coolify containers (should be empty) ---"
docker ps -a --format '{{.Names}}\t{{.Status}}' | grep -i coolify || log "(keine coolify-Container)"
log "--- edge / app ---"
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -iE 'gwada-caddy|gwada-app' || true
log "--- supabase/authelia (must be up) ---"
docker ps --format '{{.Names}}\t{{.Status}}' | grep -iE "oogd5syyxiqb1k4g0wy1u9n8|authelia" || true
log "--- kept paths ---"
ls -ld /opt/gwada/live /data/coolify/services /data/coolify/services/authelia-gwada "/data/coolify/services/${SUPABASE_SVC}" /opt/gwada-supabase-dev 2>/dev/null || true
log "--- /data/coolify tree (top) ---"
ls -la /data/coolify 2>/dev/null || true
log "--- docker network coolify ---"
docker network inspect coolify --format '{{.Name}} exists' 2>/dev/null || true

POST_INFO="$(curl -fsS https://gwada.app/api/build-info || true)"
HOME_CODE="$(curl -fsS -o /dev/null -w '%{http_code}' https://gwada.app/ || echo fail)"
LOGIN_CODE="$(curl -fsS -o /dev/null -w '%{http_code}' https://gwada.app/login || echo fail)"
log "Post build-info: ${POST_INFO}"
log "home=${HOME_CODE} login=${LOGIN_CODE}"

if [[ -z "${POST_INFO}" ]] || [[ "${HOME_CODE}" != "200" ]] || [[ "${LOGIN_CODE}" != "200" ]]; then
  echo "Post-verify failed — Live unhealthy after prune." >&2
  exit 3
fi

echo "=== COOLIFY_PRUNE_OK sha=$(echo "${POST_INFO}" | sed -n 's/.*"sha":"\([^"]*\)".*/\1/p') ==="
REMOTE
