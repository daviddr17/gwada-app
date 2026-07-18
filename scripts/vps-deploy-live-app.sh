#!/usr/bin/env bash
# Auf dem VPS: vorgebautes Image pullen, Container tauschen, /api/build-info prüfen.
# Build läuft in GitHub Actions — nicht mehr auf dem VPS.
set -euo pipefail

COOLIFY_APP_ID="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
COMPOSE_DIR="/data/coolify/applications/${COOLIFY_APP_ID}"
SCRIPTS_DIR="${GWADA_DEPLOY_SCRIPTS_DIR:-}"
APP_ORIGIN="${APP_ORIGIN:-https://gwada.app}"
LOG="${GWADA_DEPLOY_LOG:-/tmp/gwada-deploy-live-app.log}"
LOCK="${GWADA_DEPLOY_LOCK:-/tmp/gwada-deploy-live-app.lock}"
LOCK_WAIT_MAX_SEC="${GWADA_DEPLOY_LOCK_WAIT_SEC:-600}"
DEPLOY_IMAGE="${GWADA_DEPLOY_IMAGE:-}"
EXPECTED_SHA="${GWADA_DEPLOY_SHA:-${1:-}}"

force_clear_deploy_lock() {
  if [[ "${GWADA_DEPLOY_FORCE_UNLOCK:-}" != "1" ]]; then
    return 0
  fi
  if [[ ! -f "${LOCK}" ]]; then
    echo "Force unlock: kein Lock vorhanden."
    return 0
  fi
  local lock_pid
  lock_pid="$(cat "${LOCK}" 2>/dev/null || echo "")"
  echo "Force unlock: beende Deploy PID ${lock_pid:-?}, entferne Lock."
  if [[ -n "${lock_pid}" ]]; then
    kill "${lock_pid}" 2>/dev/null || true
    sleep 2
    kill -9 "${lock_pid}" 2>/dev/null || true
  fi
  rm -f "${LOCK}"
}

acquire_deploy_lock() {
  local waited=0
  while [[ -f "${LOCK}" ]]; do
    local lock_pid
    lock_pid="$(cat "${LOCK}" 2>/dev/null || echo "")"
    if [[ -z "${lock_pid}" ]] || ! kill -0 "${lock_pid}" 2>/dev/null; then
      echo "Stale deploy lock (PID ${lock_pid:-?} nicht aktiv) — entferne ${LOCK}."
      rm -f "${LOCK}"
      break
    fi
    if (( waited >= LOCK_WAIT_MAX_SEC )); then
      echo "Deploy-Lock aktiv (PID ${lock_pid}) nach ${LOCK_WAIT_MAX_SEC}s — abbrechen." >&2
      exit 1
    fi
    if (( waited == 0 )); then
      echo "Deploy läuft bereits (PID ${lock_pid}) — warte …"
    fi
    sleep 10
    waited=$((waited + 10))
  done
  echo "$$" > "${LOCK}"
}

ghcr_login() {
  local token="${GHCR_PULL_TOKEN:-${GITHUB_DEPLOY_TOKEN:-}}"
  local user="${GHCR_PULL_USER:-daviddr17}"
  if [[ -z "${token}" ]]; then
    echo "GHCR_PULL_TOKEN/GITHUB_DEPLOY_TOKEN fehlt — Pull schlägt fehl, wenn das Image privat ist." >&2
    return 1
  fi
  if ! echo "${token}" | docker login ghcr.io -u "${user}" --password-stdin; then
    echo "docker login ghcr.io fehlgeschlagen (User ${user})." >&2
    return 1
  fi
}

force_clear_deploy_lock
acquire_deploy_lock
trap 'rm -f "${LOCK}"' EXIT

exec > >(tee -a "$LOG") 2>&1
echo "=== Gwada live app deploy $(date -Is) image=${DEPLOY_IMAGE:-?} sha=${EXPECTED_SHA:-?} ==="

if [[ -z "${DEPLOY_IMAGE}" ]]; then
  echo "GWADA_DEPLOY_IMAGE fehlt — Build muss in CI oder via build-push-live-app-image.sh laufen." >&2
  exit 1
fi

if [[ ! -d "${COMPOSE_DIR}" ]]; then
  echo "Coolify-Verzeichnis fehlt: ${COMPOSE_DIR}" >&2
  exit 1
fi

# CI/SSH-Env vor Coolify-.env sichern — sonst überschreibt ein veraltetes
# GITHUB_DEPLOY_TOKEN im Compose-.env den frischen Pull-Token und GHCR → denied.
_DEPLOY_GHCR_PULL_TOKEN="${GHCR_PULL_TOKEN:-}"
_DEPLOY_GITHUB_DEPLOY_TOKEN="${GITHUB_DEPLOY_TOKEN:-}"
_DEPLOY_GHCR_PULL_USER="${GHCR_PULL_USER:-}"

if [[ -f "${COMPOSE_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${COMPOSE_DIR}/.env"
  set +a
fi

if [[ -n "${_DEPLOY_GHCR_PULL_TOKEN}" ]]; then
  export GHCR_PULL_TOKEN="${_DEPLOY_GHCR_PULL_TOKEN}"
fi
if [[ -n "${_DEPLOY_GITHUB_DEPLOY_TOKEN}" ]]; then
  export GITHUB_DEPLOY_TOKEN="${_DEPLOY_GITHUB_DEPLOY_TOKEN}"
fi
if [[ -n "${_DEPLOY_GHCR_PULL_USER}" ]]; then
  export GHCR_PULL_USER="${_DEPLOY_GHCR_PULL_USER}"
fi

APP_ORIGIN="${NEXT_PUBLIC_SITE_URL:-${APP_ORIGIN}}"

COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yaml"
if [[ ! -f "${COMPOSE_FILE}" ]]; then
  COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
fi

ghcr_login

echo "Pull ${DEPLOY_IMAGE} …"
docker pull "${DEPLOY_IMAGE}"

if [[ -f "${COMPOSE_FILE}" ]]; then
  if grep -q "image: '${COOLIFY_APP_ID}:" "${COMPOSE_FILE}"; then
    sed -i "s|image: '${COOLIFY_APP_ID}:.*'|image: '${DEPLOY_IMAGE}'|" "${COMPOSE_FILE}"
  elif grep -q "image: 'ghcr.io/" "${COMPOSE_FILE}"; then
    sed -i "s|image: 'ghcr.io/[^']*'|image: '${DEPLOY_IMAGE}'|" "${COMPOSE_FILE}"
  else
    sed -i "0,/image: '/s|image: '[^']*'|image: '${DEPLOY_IMAGE}'|" "${COMPOSE_FILE}"
  fi
  echo "Compose-Image → ${DEPLOY_IMAGE}"
fi

patch_compose_env_key() {
  local key="$1"
  local value="$2"
  for env_file in "${COMPOSE_DIR}/.env" "${COMPOSE_DIR}/.env.production"; do
    [[ -f "${env_file}" ]] || continue
    grep -v "^${key}=" "${env_file}" > "${env_file}.tmp" || true
    printf '%s=%s\n' "${key}" "${value}" >> "${env_file}.tmp"
    mv "${env_file}.tmp" "${env_file}"
    echo "${key} in ${env_file} gesetzt."
  done
}

if [[ -n "${CHANGELOG_SYNC_SECRET:-}" ]]; then
  patch_compose_env_key CHANGELOG_SYNC_SECRET "${CHANGELOG_SYNC_SECRET}"
fi
if [[ -n "${GITHUB_DEPLOY_TOKEN:-}" ]]; then
  patch_compose_env_key GITHUB_DEPLOY_TOKEN "${GITHUB_DEPLOY_TOKEN}"
fi
if [[ -n "${CRON_SECRET:-}" ]]; then
  patch_compose_env_key CRON_SECRET "${CRON_SECRET}"
fi

ENSURE_RUNTIME_ENV="${SCRIPTS_DIR}/ensure-coolify-compose-runtime-env.sh"
if [[ -f "${ENSURE_RUNTIME_ENV}" ]]; then
  # shellcheck source=scripts/ensure-coolify-compose-runtime-env.sh
  source "${ENSURE_RUNTIME_ENV}"
  ensure_coolify_compose_runtime_env "${COMPOSE_DIR}" \
    GITHUB_DEPLOY_TOKEN CHANGELOG_SYNC_SECRET CRON_SECRET SUPABASE_SERVICE_ROLE_KEY || true
fi

ENSURE_TRAEFIK="${SCRIPTS_DIR}/vps-ensure-coolify-traefik-fqdn.sh"
if [[ -f "${ENSURE_TRAEFIK}" ]]; then
  DEPLOY_FQDN="${APP_ORIGIN#https://}"
  DEPLOY_FQDN="${DEPLOY_FQDN#http://}"
  DEPLOY_FQDN="${DEPLOY_FQDN%%/*}"
  COOLIFY_FQDN="${DEPLOY_FQDN}" bash "${ENSURE_TRAEFIK}" "${COMPOSE_DIR}" "${COOLIFY_APP_ID}"
else
  cd "${COMPOSE_DIR}"
  docker compose up -d --force-recreate --remove-orphans
fi

VERIFY_SHA="${EXPECTED_SHA:-}"
if [[ -z "${VERIFY_SHA}" && "${DEPLOY_IMAGE}" == *:* ]]; then
  VERIFY_SHA="${DEPLOY_IMAGE##*:}"
fi

echo "Warte auf App (sha=${VERIFY_SHA:-?}) …"
for i in $(seq 1 90); do
  if [[ -n "${VERIFY_SHA}" ]] && curl -fsSL "${APP_ORIGIN}/api/build-info" 2>/dev/null | grep -q "\"sha\":\"${VERIFY_SHA}\""; then
    echo "✓ Live bestätigt: ${APP_ORIGIN}/api/build-info → sha=${VERIFY_SHA}"
    docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep 3000 || true
    fresh_running="$(docker ps --format '{{.Names}}' | grep "${COOLIFY_APP_ID}-" | head -1 || true)"
    if [[ -n "${fresh_running}" ]] && declare -F verify_container_env >/dev/null; then
      verify_container_env "${fresh_running}" GITHUB_DEPLOY_TOKEN || true
    fi
    echo "=== DEPLOY_OK $(date -Is) ==="
    exit 0
  fi
  sleep 3
done

echo "WARNUNG: /api/build-info zeigt nicht sha=${VERIFY_SHA}." >&2
curl -fsSL "${APP_ORIGIN}/api/build-info" 2>/dev/null || true
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep 3000 || true
exit 1
