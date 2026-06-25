#!/usr/bin/env bash
# Dev-Kong auf Host :8100 sicherstellen + .env.development für Mac (direkt oder Tunnel).
set -euo pipefail

INSTALL_DIR="${GWADA_DEV_SUPABASE_DIR:-/opt/gwada-supabase-dev}"
KONG_HOST_PORT="${GWADA_DEV_KONG_PORT:-8100}"
VPS_HOST="${GWADA_VPS_PUBLIC_HOST:-95.111.229.250}"
ENV_OUT="${GWADA_DEV_ENV_OUT:-/root/gwada-dev-env.development}"

cd "${INSTALL_DIR}"
export COMPOSE_PROJECT_NAME=gwada-dev

# Kong muss auf 0.0.0.0:8100 lauschen (Mac ohne Tunnel)
if grep -q '^KONG_HTTP_PORT=' .env; then
  sed -i "s|^KONG_HTTP_PORT=.*|KONG_HTTP_PORT=${KONG_HOST_PORT}|" .env
else
  echo "KONG_HTTP_PORT=${KONG_HOST_PORT}" >> .env
fi

docker compose up -d kong db auth rest storage realtime meta studio 2>/dev/null \
  || docker compose up -d --no-recreate 2>/dev/null \
  || true

for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${KONG_HOST_PORT}/auth/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

DB_CONTAINER="$(docker compose ps -q db)"
KONG_CONTAINER="$(docker compose ps -q kong)"
DB_IP="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${DB_CONTAINER}")"
KONG_IP="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${KONG_CONTAINER}")"
echo "${DB_IP}" > "${INSTALL_DIR}/.postgres_container_ip"

read_env_key() {
  local key="$1"
  grep -m1 "^${key}=" .env | sed "s/^${key}=//" | tr -d '\r\n'
}

ANON_KEY="$(read_env_key ANON_KEY)"
SERVICE_ROLE_KEY="$(read_env_key SERVICE_ROLE_KEY)"
POSTGRES_PASSWORD="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r')"

ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${POSTGRES_PASSWORD}")"

cat > "${ENV_OUT}" <<EOF
# Generiert von scripts/vps-refresh-dev-env.sh — nicht committen.

NEXT_PUBLIC_SUPABASE_PROXY=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# Direkt vom Mac (kein SSH-Tunnel nötig, wenn Port ${KONG_HOST_PORT} offen):
NEXT_PUBLIC_SUPABASE_URL=http://${VPS_HOST}:${KONG_HOST_PORT}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo
NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false

DEV_TUNNEL_REMOTE_HOST=${DB_IP}
DEV_KONG_CONTAINER_IP=${KONG_IP}
# Optional Tunnel (pnpm db:tunnel:dev): Postgres + API auf localhost
DEV_API_TUNNEL_LOCAL_PORT=${KONG_HOST_PORT}
SUPABASE_DB_URL=postgresql://postgres:${ENC_PW}@127.0.0.1:5434/postgres?sslmode=disable
EOF

chmod 600 "${ENV_OUT}"
echo "✓ ${ENV_OUT} (gwada-demo, API http://${VPS_HOST}:${KONG_HOST_PORT})"
