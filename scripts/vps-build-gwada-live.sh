#!/usr/bin/env bash
# Manueller Live-Build auf dem VPS (Fallback wenn Coolify-GitHub-Deploy scheitert).
set -euo pipefail

APP_ORIGIN="${APP_ORIGIN:-http://95.111.229.250:3000}"
UPSTREAM="${SUPABASE_UPSTREAM:-http://95.111.229.250:8001}"
REPO="${REPO:-https://github.com/daviddr17/gwada-app.git}"
BRANCH="${BRANCH:-main}"
IMAGE_TAG="${IMAGE_TAG:-d3cg1b54arvue2tcm8u34qty:live-proxy}"
CONTAINER="${CONTAINER:-d3cg1b54arvue2tcm8u34qty-161504106736}"
BUILD_DIR="${BUILD_DIR:-/tmp/gwada-app-live-build}"

if [[ -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt" >&2
  exit 1
fi

rm -rf "${BUILD_DIR}"
git clone --depth 1 --branch "${BRANCH}" "${REPO}" "${BUILD_DIR}"
cd "${BUILD_DIR}"

export NEXT_PUBLIC_SUPABASE_PROXY=true
export SUPABASE_UPSTREAM_URL="${UPSTREAM}"
export NEXT_PUBLIC_SITE_URL="${APP_ORIGIN}"
export NEXT_PUBLIC_SUPABASE_URL="${APP_ORIGIN}/sb"
export NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false
export NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo

docker build -t "${IMAGE_TAG}" -f - . <<EOF
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_PUBLIC_SUPABASE_PROXY=true
ENV SUPABASE_UPSTREAM_URL=${UPSTREAM}
ENV NEXT_PUBLIC_SITE_URL=${APP_ORIGIN}
ENV NEXT_PUBLIC_SUPABASE_URL=${APP_ORIGIN}/sb
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false
ENV NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NEXT_PUBLIC_SUPABASE_PROXY=true
ENV SUPABASE_UPSTREAM_URL=${UPSTREAM}
ENV NEXT_PUBLIC_SITE_URL=${APP_ORIGIN}
ENV NEXT_PUBLIC_SUPABASE_URL=${APP_ORIGIN}/sb
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false
ENV NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
EOF

docker stop "${CONTAINER}" 2>/dev/null || true
docker rm -f "${CONTAINER}" 2>/dev/null || true

COMPOSE_DIR="/data/coolify/applications/d3cg1b54arvue2tcm8u34qty"
sed -i "s|image: 'd3cg1b54arvue2tcm8u34qty:.*'|image: '${IMAGE_TAG}'|" "${COMPOSE_DIR}/docker-compose.yaml"
cd "${COMPOSE_DIR}" && docker compose up -d

echo "✓ Live image ${IMAGE_TAG} deployed"
