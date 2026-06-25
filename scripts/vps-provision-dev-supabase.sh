#!/usr/bin/env bash
# Idempotent: zweiter Supabase-Stack für Entwicklung auf dem VPS (/opt/gwada-supabase-dev).
# Läuft per GitHub Actions (LIVE_SSH_KEY) oder manuell auf dem Server.
set -euo pipefail

INSTALL_DIR="${GWADA_DEV_SUPABASE_DIR:-/opt/gwada-supabase-dev}"
KONG_HOST_PORT="${GWADA_DEV_KONG_PORT:-8100}"
STUDIO_HOST_PORT="${GWADA_DEV_STUDIO_PORT:-54324}"
DEV_TUNNEL_REMOTE_HOST_FILE="${INSTALL_DIR}/.postgres_container_ip"
ENV_OUT="${GWADA_DEV_ENV_OUT:-/root/gwada-dev-env.development}"

log() { echo "[gwada-dev-supabase] $*"; }

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker fehlt auf dem VPS." >&2
  exit 1
fi

mkdir -p "${INSTALL_DIR}"

if [[ ! -f "${INSTALL_DIR}/docker-compose.yml" ]]; then
  log "Supabase Docker-Stack wird vorbereitet (nur docker/-Ordner) …"
  tmp="${INSTALL_DIR}/_supabase_src"
  rm -rf "${tmp}"
  git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase.git "${tmp}"
  git -C "${tmp}" sparse-checkout set docker
  cp -a "${tmp}/docker/." "${INSTALL_DIR}/"
  rm -rf "${tmp}"
fi

cd "${INSTALL_DIR}"

# Feste container_name in upstream-compose kollidieren mit Live-Coolify — eindeutige Dev-Namen
if [[ ! -f .gwada-dev-compose-patched ]]; then
  log "Compose patchen (gwada-dev-* Container & Volumes) …"
  sed -i 's/container_name: supabase-/container_name: gwada-dev-/g' docker-compose.yml
  sed -i 's/name: supabase-/name: gwada-dev-/g' docker-compose.yml 2>/dev/null || true
  touch .gwada-dev-compose-patched
fi

export COMPOSE_PROJECT_NAME=gwada-dev

if [[ ! -f .env ]]; then
  log "Neue .env für Dev-Stack …"
  cp .env.example .env
  if [[ -x ./utils/generate-keys.sh ]]; then
    ./utils/generate-keys.sh .env
  fi
  POSTGRES_PASSWORD="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
  if ! grep -q '^POSTGRES_PASSWORD=' .env; then
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" >> .env
  fi
fi

# Ports: Kong öffentlich für Mac-Dev (nur API), Studio optional intern
upsert_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

upsert_env "KONG_HTTP_PORT" "${KONG_HOST_PORT}"
upsert_env "KONG_HTTPS_PORT" "$((KONG_HOST_PORT + 1))"
upsert_env "STUDIO_PORT" "${STUDIO_HOST_PORT}"
upsert_env "SITE_URL" "http://localhost:3000"
upsert_env "API_EXTERNAL_URL" "http://127.0.0.1:${KONG_HOST_PORT}"
upsert_env "SUPABASE_PUBLIC_URL" "http://127.0.0.1:${KONG_HOST_PORT}"

# GoTrue: lokale Redirects
upsert_env "ADDITIONAL_REDIRECT_URLS" "http://localhost:3000/auth/callback,http://localhost:3000/api/auth/google/callback"

log "docker compose pull (kann mehrere Minuten dauern) …"
docker compose pull

log "docker compose up …"
docker compose up -d

log "Warte auf Postgres …"
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

DB_CONTAINER="$(docker compose ps -q db)"
KONG_CONTAINER="$(docker compose ps -q kong)"
[[ -n "${DB_CONTAINER}" ]] || { echo "DB-Container fehlt." >&2; exit 1; }

DB_IP="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${DB_CONTAINER}")"
KONG_IP="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${KONG_CONTAINER}")"
echo "${DB_IP}" > "${DEV_TUNNEL_REMOTE_HOST_FILE}"

# Kong auf Host-Port binden (falls Compose das nicht schon tut)
if ! ss -tln 2>/dev/null | grep -q ":${KONG_HOST_PORT} " && ! netstat -tln 2>/dev/null | grep -q ":${KONG_HOST_PORT} "; then
  log "WARNUNG: Kong-Port ${KONG_HOST_PORT} nicht am Host — API-Tunnel nötig (pnpm db:tunnel:dev)."
fi

# Keys aus .env (nicht source — Werte können Leerzeichen enthalten)
read_env_key() {
  local key="$1"
  grep -m1 "^${key}=" .env | cut -d= -f2- | tr -d '\r'
}

ANON_KEY="$(read_env_key ANON_KEY)"
SERVICE_ROLE_KEY="$(read_env_key SERVICE_ROLE_KEY)"
POSTGRES_PASSWORD="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r')"

cat > "${ENV_OUT}" <<EOF
# Generiert von scripts/vps-provision-dev-supabase.sh — nicht committen.
# Lokal: cp nach .env.development oder pnpm setup:dev:env

NEXT_PUBLIC_SUPABASE_PROXY=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${KONG_HOST_PORT}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-dev
NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false

DEV_TUNNEL_REMOTE_HOST=${DB_IP}
DEV_KONG_CONTAINER_IP=${KONG_IP}
SUPABASE_DB_URL=postgresql://postgres:${POSTGRES_PASSWORD}@127.0.0.1:5434/postgres?sslmode=disable
EOF

chmod 600 "${ENV_OUT}"

log "Dev-Stack bereit."
log "Env-Vorlage: ${ENV_OUT}"
log "Kong (VPS): http://127.0.0.1:${KONG_HOST_PORT} (von Mac: SSH-Tunnel oder Host-Port)"
log "Postgres-Container-IP: ${DB_IP}"
