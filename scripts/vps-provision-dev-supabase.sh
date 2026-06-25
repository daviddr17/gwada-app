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

# Feste container_name in upstream-compose kollidieren mit Live — eindeutige gwada-dev-* Namen
patch_dev_compose() {
  local old new line
  while IFS= read -r line; do
    old="${line#*container_name: }"
    old="${old// /}"
    [[ -z "${old}" || "${old}" == gwada-dev-* ]] && continue
    new="gwada-dev-${old}"
    sed -i "s|container_name: ${old}|container_name: ${new}|g" docker-compose.yml
  done < <(grep 'container_name:' docker-compose.yml 2>/dev/null || true)
  sed -i 's/name: supabase-/name: gwada-dev-/g' docker-compose.yml 2>/dev/null || true
  # Pooler nicht auf Host :5432 (Live-Postgres auf dem VPS)
  sed -i 's|- "${POSTGRES_PORT:-5432}:5432"|- "${POSTGRES_PORT:-5435}:5432"|g' docker-compose.yml 2>/dev/null || true
  sed -i 's|- "5432:5432"|- "5435:5432"|g' docker-compose.yml 2>/dev/null || true
}

if [[ -f docker-compose.yml ]]; then
  log "Compose patchen (gwada-dev-* Container & Volumes) …"
  patch_dev_compose
fi

export COMPOSE_PROJECT_NAME=gwada-dev

if [[ "${GWADA_DEV_FORCE_VOLUME_RESET:-0}" == "1" ]]; then
  log "Volume-Reset: Dev-Stack und Volumes entfernen …"
  if [[ -f docker-compose.yml ]]; then
    docker compose stop -t 15 2>/dev/null || true
    docker compose rm -f 2>/dev/null || true
    docker compose down -v --remove-orphans 2>/dev/null || true
  fi
  if ids="$(docker ps -aq --filter name=gwada-dev-)"; [[ -n "${ids}" ]]; then
    docker rm -f ${ids}
  fi
  while read -r vol; do
    [[ -z "${vol}" ]] && continue
    docker volume rm -f "${vol}" 2>/dev/null || true
  done < <(docker volume ls -q | grep -E 'gwada-dev|gwada_dev' || true)
  rm -rf "${INSTALL_DIR}/volumes/db/data" "${INSTALL_DIR}/volumes/storage" 2>/dev/null || true
  log "Postgres-Daten (volumes/db/data) entfernt."
  rm -f .env .secrets-rotated-after-leak
  log "Alte .env entfernt — wird neu erzeugt."
fi

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
# Pooler-Host-Port ≠ Live-Postgres :5432 — intern lauscht Postgres auf 5435
upsert_env "POSTGRES_PORT" "5435"
upsert_env "POOLER_PROXY_PORT_TRANSACTION" "6544"
upsert_env "POOLER_PROXY_PORT_SESSION" "6545"
VPS_PUBLIC_HOST="${GWADA_VPS_PUBLIC_HOST:-95.111.229.250}"
upsert_env "SITE_URL" "http://localhost:3000"
# Mac-Dev spricht Kong direkt auf VPS-IP — GoTrue-JWT/Redirects müssen erreichbar sein
upsert_env "API_EXTERNAL_URL" "http://${VPS_PUBLIC_HOST}:${KONG_HOST_PORT}"
upsert_env "SUPABASE_PUBLIC_URL" "http://${VPS_PUBLIC_HOST}:${KONG_HOST_PORT}"

# GoTrue: lokale Redirects + Dev ohne SMTP
upsert_env "ADDITIONAL_REDIRECT_URLS" "http://localhost:3000/auth/callback,http://localhost:3000/api/auth/google/callback"
upsert_env "GOTRUE_MAILER_AUTOCONFIRM" "true"
upsert_env "ENABLE_EMAIL_SIGNUP" "true"

if [[ "${GWADA_DEV_FORCE_VOLUME_RESET:-0}" == "1" ]]; then
  log "Volume-Reset angefordert — übersprungen (bereits oben ausgeführt)."
fi

log "docker compose pull (kann mehrere Minuten dauern) …"
if docker ps --format '{{.Names}}' | grep -q '^gwada-dev-db$' \
  && docker ps --format '{{.Names}}' | grep -q '^gwada-dev-kong$'; then
  log "Dev-Stack läuft bereits — überspringe pull/up."
else
  docker compose pull
  log "docker compose up …"
  mapfile -t DEV_SERVICES < <(docker compose config --services | grep -Ev '^(supavisor|pooler)$' || docker compose config --services)
  if [[ "${GWADA_DEV_FORCE_VOLUME_RESET:-0}" == "1" ]]; then
    log "Frisches Volume — nur Postgres starten (Migrationen starten übrige Services) …"
    docker compose up -d db
    for i in $(seq 1 60); do
      docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && break
      sleep 2
    done
    docker compose exec -T db pg_isready -U postgres
  else
    docker compose up -d "${DEV_SERVICES[@]}"
  fi
fi

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
KONG_IP=""
if [[ -n "${KONG_CONTAINER}" ]]; then
  KONG_IP="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${KONG_CONTAINER}")"
fi
echo "${DB_IP}" > "${DEV_TUNNEL_REMOTE_HOST_FILE}"

# Kong auf Host-Port binden (falls Compose das nicht schon tut)
if ! ss -tln 2>/dev/null | grep -q ":${KONG_HOST_PORT} " && ! netstat -tln 2>/dev/null | grep -q ":${KONG_HOST_PORT} "; then
  log "WARNUNG: Kong-Port ${KONG_HOST_PORT} nicht am Host — API-Tunnel nötig (pnpm db:tunnel:dev)."
fi

# Keys aus .env (nicht source — Werte können Leerzeichen enthalten)
read_env_key() {
  local key="$1"
  grep -m1 "^${key}=" .env | sed "s/^${key}=//" | tr -d '\r\n'
}

if [[ -x "${INSTALL_DIR}/vps-refresh-dev-env.sh" ]] || [[ -f /tmp/vps-refresh-dev-env.sh ]]; then
  GWADA_VPS_PUBLIC_HOST="${GWADA_VPS_PUBLIC_HOST:-95.111.229.250}" \
    bash "${INSTALL_DIR}/vps-refresh-dev-env.sh" 2>/dev/null || \
    GWADA_VPS_PUBLIC_HOST="${GWADA_VPS_PUBLIC_HOST:-95.111.229.250}" \
    bash /tmp/vps-refresh-dev-env.sh
else
  ANON_KEY="$(read_env_key ANON_KEY)"
  SERVICE_ROLE_KEY="$(read_env_key SERVICE_ROLE_KEY)"
  POSTGRES_PASSWORD="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r')"
  ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${POSTGRES_PASSWORD}" 2>/dev/null || echo "${POSTGRES_PASSWORD}")"

  cat > "${ENV_OUT}" <<EOF
NEXT_PUBLIC_SUPABASE_PROXY=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://95.111.229.250:${KONG_HOST_PORT}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo
NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false
DEV_TUNNEL_REMOTE_HOST=${DB_IP}
DEV_KONG_CONTAINER_IP=${KONG_IP}
SUPABASE_DB_URL=postgresql://postgres:${ENC_PW}@127.0.0.1:5434/postgres?sslmode=disable
EOF
  chmod 600 "${ENV_OUT}"
fi

log "Dev-Stack bereit."
log "Env-Vorlage: ${ENV_OUT}"
log "Kong (VPS): http://95.111.229.250:${KONG_HOST_PORT}"
log "Postgres-Container-IP: ${DB_IP}"
