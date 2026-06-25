#!/usr/bin/env bash
# Rotiert Dev-Postgres-Passwort auf dem VPS — idempotent per Marker.
set -euo pipefail

INSTALL_DIR="${GWADA_DEV_SUPABASE_DIR:-/opt/gwada-supabase-dev}"
MARKER="${GWADA_DEV_SECRETS_MARKER:-${INSTALL_DIR}/.secrets-rotated-after-leak}"
FORCE="${GWADA_FORCE_DEV_SECRET_ROTATE:-0}"

log() { echo "[gwada-dev-rotate] $*"; }

if [[ -f "${MARKER}" && "${FORCE}" != "1" ]]; then
  log "Bereits rotiert ($(cat "${MARKER}")) — übersprungen."
  exit 0
fi

cd "${INSTALL_DIR}"
export COMPOSE_PROJECT_NAME=gwada-dev

NEW_PW="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
OLD_PW="$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//' | tr -d '\r\n')"

log "Postgres-Passwort rotieren …"
if docker compose exec -T -e PGPASSWORD="${OLD_PW}" db \
  psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER USER postgres WITH PASSWORD '${NEW_PW}';" \
  -c "ALTER USER supabase_admin WITH PASSWORD '${NEW_PW}';" 2>/dev/null; then
  log "via supabase_admin OK"
else
  docker compose exec -T db \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "ALTER USER postgres WITH PASSWORD '${NEW_PW}';"
fi

if grep -q '^POSTGRES_PASSWORD=' .env; then
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${NEW_PW}|" .env
else
  echo "POSTGRES_PASSWORD=${NEW_PW}" >> .env
fi

log "Auth/REST neu erstellen (DB-Passwort aus .env) …"
docker compose up -d --force-recreate auth rest 2>/dev/null \
  || docker compose up -d auth rest

for i in $(seq 1 20); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

date -u +"%Y-%m-%dT%H:%M:%SZ" > "${MARKER}"
log "✓ Dev-Postgres-Passwort rotiert. Marker: ${MARKER}"
