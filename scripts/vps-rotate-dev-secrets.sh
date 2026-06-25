#!/usr/bin/env bash
# Rotiert Dev-Postgres-Passwort (und optional JWT) auf dem VPS — idempotent per Marker.
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

log "Postgres-Passwort rotieren …"
docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 \
  -c "ALTER USER postgres WITH PASSWORD '${NEW_PW}';"

if grep -q '^POSTGRES_PASSWORD=' .env; then
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${NEW_PW}|" .env
else
  echo "POSTGRES_PASSWORD=${NEW_PW}" >> .env
fi

if [[ -x ./utils/generate-keys.sh ]]; then
  log "JWT-Keys neu generieren …"
  ./utils/generate-keys.sh .env
fi

log "Services neu starten …"
docker compose up -d

for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

date -u +"%Y-%m-%dT%H:%M:%SZ" > "${MARKER}"
log "✓ Dev-Secrets rotiert. Marker: ${MARKER}"
