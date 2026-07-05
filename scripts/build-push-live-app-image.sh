#!/usr/bin/env bash
# Lokal/CI: Docker-Image bauen und nach GHCR pushen. Gibt Image-Referenz auf stdout aus.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/live-app-image.sh
source "${ROOT}/scripts/live-app-image.sh"

REF="${1:-HEAD}"
SHA="$(git -C "${ROOT}" rev-parse --short "${REF}")"
FULL_SHA="$(git -C "${ROOT}" rev-parse "${REF}")"
IMAGE="$(live_app_image_for_sha "${SHA}")"

ANON="${LIVE_NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
UPSTREAM="${LIVE_SUPABASE_UPSTREAM_URL:-}"

if [[ -z "${ANON}" && ( -n "${LIVE_SSH_KEY:-}" || -n "${LIVE_VPS_HOST:-}" ) ]]; then
  eval "$(bash "${ROOT}/scripts/ci-read-live-build-env.sh")"
  ANON="${anon_key:-}"
  UPSTREAM="${supabase_upstream:-}"
fi

if [[ -z "${ANON}" && -f "${ROOT}/.env.production" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env.production"
  set +a
  ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
  UPSTREAM="${SUPABASE_UPSTREAM_URL:-${UPSTREAM}}"
fi

UPSTREAM="${UPSTREAM:-http://supabase-kong-oogd5syyxiqb1k4g0wy1u9n8:8000}"

if [[ -z "${ANON}" ]]; then
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt (VPS .env, LIVE_NEXT_PUBLIC_SUPABASE_ANON_KEY oder .env.production)." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker läuft nicht." >&2
  exit 1
fi

if [[ -n "${GHCR_PUSH_TOKEN:-${GITHUB_TOKEN:-}}" ]]; then
  echo "${GHCR_PUSH_TOKEN:-${GITHUB_TOKEN}}" | docker login ghcr.io -u "${GHCR_PUSH_USER:-daviddr17}" --password-stdin
else
  echo "Hinweis: nicht bei ghcr.io eingeloggt — Push schlägt fehl, wenn das Paket privat ist." >&2
fi

echo "→ Build & push ${IMAGE} (+ ${FULL_SHA}) …" >&2
docker buildx build \
  --platform linux/amd64 \
  --push \
  -t "${IMAGE}" \
  -t "${GWADA_LIVE_APP_IMAGE_REPO}:${FULL_SHA}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}" \
  --build-arg "NEXT_PUBLIC_SITE_URL=https://gwada.app" \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=https://gwada.app/sb" \
  --build-arg "NEXT_PUBLIC_SUPABASE_PROXY=true" \
  --build-arg "NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false" \
  --build-arg "NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo" \
  --build-arg "SUPABASE_UPSTREAM_URL=${UPSTREAM}" \
  --build-arg "GWADA_BUILD_SHA=${SHA}" \
  -f "${ROOT}/Dockerfile" \
  "${ROOT}" >&2

echo "${IMAGE}"
