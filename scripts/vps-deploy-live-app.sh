#!/usr/bin/env bash
# Auf dem VPS ausführen: baut main (oder COMMIT), tauscht Container aus, prüft /api/build-info.
# Behebt das Problem, dass Coolify „finished“ meldet, aber ein altes Image (z. B. live-proxy) läuft.
set -euo pipefail

COOLIFY_APP_ID="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
COMPOSE_DIR="/data/coolify/applications/${COOLIFY_APP_ID}"
REPO="${GWADA_GIT_REPO:-https://github.com/daviddr17/gwada-app.git}"
BRANCH="${GWADA_DEPLOY_BRANCH:-main}"
BUILD_DIR="${GWADA_BUILD_DIR:-/tmp/gwada-app-deploy}"
COMMIT="${1:-${GWADA_DEPLOY_COMMIT:-}}"
APP_ORIGIN="${APP_ORIGIN:-https://new.gwada.app}"
UPSTREAM="${SUPABASE_UPSTREAM:-http://supabase-kong-oogd5syyxiqb1k4g0wy1u9n8:8000}"
LOG="${GWADA_DEPLOY_LOG:-/tmp/gwada-deploy-live-app.log}"
LOCK="${GWADA_DEPLOY_LOCK:-/tmp/gwada-deploy-live-app.lock}"
LOCK_WAIT_MAX_SEC="${GWADA_DEPLOY_LOCK_WAIT_SEC:-2100}"

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
  pkill -f "${BUILD_DIR}" 2>/dev/null || true
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
      echo "Parallele Builds vermeiden — anderen Deploy beenden oder später erneut starten." >&2
      exit 1
    fi
    if (( waited == 0 )); then
      echo "Deploy läuft bereits (PID ${lock_pid}) — warte auf Abschluss …"
    fi
    sleep 30
    waited=$((waited + 30))
  done
  echo "$$" > "${LOCK}"
}

force_clear_deploy_lock
acquire_deploy_lock
trap 'rm -f "${LOCK}"' EXIT

exec > >(tee -a "$LOG") 2>&1
echo "=== Gwada live app deploy $(date -Is) commit=${COMMIT:-latest} ==="

if [[ ! -d "${COMPOSE_DIR}" ]]; then
  echo "Coolify-Verzeichnis fehlt: ${COMPOSE_DIR}" >&2
  exit 1
fi

if [[ -f "${COMPOSE_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${COMPOSE_DIR}/.env"
  set +a
fi

APP_ORIGIN="${NEXT_PUBLIC_SITE_URL:-${APP_ORIGIN}}"
UPSTREAM="${SUPABASE_UPSTREAM_URL:-${UPSTREAM}}"

RUNNING="$(docker ps --format '{{.Names}}' | grep "${COOLIFY_APP_ID}-" | head -1 || true)"
ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
if [[ -z "${ANON}" && -n "${RUNNING}" ]]; then
  ANON="$(docker exec "${RUNNING}" printenv NEXT_PUBLIC_SUPABASE_ANON_KEY 2>/dev/null || true)"
fi
if [[ -z "${ANON}" ]]; then
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt (.env oder laufender Container)." >&2
  exit 1
fi

rm -rf "${BUILD_DIR}"
git clone --depth 1 --branch "${BRANCH}" "${REPO}" "${BUILD_DIR}"
cd "${BUILD_DIR}"

if [[ -n "${COMMIT}" ]]; then
  git fetch --depth 1 origin "${COMMIT}"
  git checkout "${COMMIT}"
fi

SHA="$(git rev-parse --short HEAD)"
FULL_SHA="$(git rev-parse HEAD)"
IMAGE="${COOLIFY_APP_ID}:${SHA}"

echo "Build ${IMAGE} (${FULL_SHA}) …"

docker build -t "${IMAGE}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}" \
  --build-arg "NEXT_PUBLIC_SITE_URL=${APP_ORIGIN}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=${APP_ORIGIN}/sb" \
  --build-arg "NEXT_PUBLIC_SUPABASE_PROXY=true" \
  --build-arg "NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false" \
  --build-arg "NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo" \
  --build-arg "SUPABASE_UPSTREAM_URL=${UPSTREAM}" \
  --build-arg "GWADA_BUILD_SHA=${SHA}" \
  -f Dockerfile .

docker tag "${IMAGE}" "${COOLIFY_APP_ID}:${FULL_SHA}"

COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yaml"
if [[ ! -f "${COMPOSE_FILE}" ]]; then
  COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
fi

sed -i "s|image: '${COOLIFY_APP_ID}:.*'|image: '${IMAGE}'|" "${COMPOSE_FILE}"

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

ENSURE_TRAEFIK="${BUILD_DIR}/scripts/vps-ensure-coolify-traefik-fqdn.sh"
if [[ -f "${ENSURE_TRAEFIK}" ]]; then
  bash "${ENSURE_TRAEFIK}" "${COMPOSE_DIR}" "${COOLIFY_APP_ID}"
else
  cd "${COMPOSE_DIR}"
  docker compose up -d --force-recreate --remove-orphans
fi

echo "Warte auf App …"
for i in $(seq 1 45); do
  if curl -fsSL "${APP_ORIGIN}/api/build-info" 2>/dev/null | grep -q "\"sha\":\"${SHA}\""; then
    echo "✓ Live bestätigt: ${APP_ORIGIN}/api/build-info → sha=${SHA}"
    docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep 3000 || true
    echo "=== DEPLOY_OK $(date -Is) ==="
    exit 0
  fi
  sleep 3
done

echo "WARNUNG: Container läuft, aber /api/build-info zeigt nicht sha=${SHA}." >&2
curl -fsSL "${APP_ORIGIN}/api/build-info" 2>/dev/null || true
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep 3000 || true
exit 1
