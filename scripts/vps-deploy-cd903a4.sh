#!/usr/bin/env bash
# Runs ON the VPS — clone main, docker build, swap Coolify compose image.
set -euo pipefail

APP_ORIGIN="${APP_ORIGIN:-http://95.111.229.250:3000}"
UPSTREAM="${SUPABASE_UPSTREAM:-http://95.111.229.250:8001}"
REPO="${REPO:-https://github.com/daviddr17/gwada-app.git}"
BRANCH="${BRANCH:-main}"
IMAGE_TAG="${IMAGE_TAG:-d3cg1b54arvue2tcm8u34qty:0054bf9}"
BUILD_DIR="${BUILD_DIR:-/tmp/gwada-app-live-build}"
COMPOSE_DIR="/data/coolify/applications/d3cg1b54arvue2tcm8u34qty"
LOG="/tmp/gwada-deploy.log"

exec > >(tee -a "$LOG") 2>&1
echo "=== Gwada deploy $(date -Is) tag=${IMAGE_TAG} ==="

RUNNING="$(docker ps --format '{{.Names}}' | grep 'd3cg1b54arvue2tcm8u34qty-' | head -1 || true)"
if [[ -z "${RUNNING}" ]]; then
  echo "Kein Gwada-Container auf Port 3000 gefunden." >&2
  exit 1
fi

ANON="$(docker exec "${RUNNING}" printenv NEXT_PUBLIC_SUPABASE_ANON_KEY || true)"
if [[ -z "${ANON}" ]]; then
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt im laufenden Container." >&2
  exit 1
fi

rm -rf "${BUILD_DIR}"
git clone --depth 1 --branch "${BRANCH}" "${REPO}" "${BUILD_DIR}"
cd "${BUILD_DIR}"

docker build -t "${IMAGE_TAG}" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="${ANON}" \
  -f - . <<DOCKERFILE
FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_PUBLIC_SUPABASE_PROXY=true
ENV SUPABASE_UPSTREAM_URL=${UPSTREAM}
ENV NEXT_PUBLIC_SITE_URL=${APP_ORIGIN}
ENV NEXT_PUBLIC_SUPABASE_URL=${APP_ORIGIN}/sb
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=\${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false
ENV NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NEXT_PUBLIC_SUPABASE_PROXY=true
ENV SUPABASE_UPSTREAM_URL=${UPSTREAM}
ENV NEXT_PUBLIC_SITE_URL=${APP_ORIGIN}
ENV NEXT_PUBLIC_SUPABASE_URL=${APP_ORIGIN}/sb
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=\${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false
ENV NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
DOCKERFILE

sed -i "s|image: 'd3cg1b54arvue2tcm8u34qty:.*'|image: '${IMAGE_TAG}'|" "${COMPOSE_DIR}/docker-compose.yaml"
cd "${COMPOSE_DIR}" && docker compose up -d

docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep 3000 || true
echo "=== DEPLOY_DONE $(date -Is) ==="
