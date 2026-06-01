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

COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yaml"
if [[ ! -f "${COMPOSE_FILE}" ]]; then
  COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"
fi

sed -i "s|image: '${COOLIFY_APP_ID}:.*'|image: '${IMAGE}'|" "${COMPOSE_FILE}"

cd "${COMPOSE_DIR}"
docker compose up -d --force-recreate --remove-orphans

echo "Warte auf App …"
for i in $(seq 1 30); do
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
