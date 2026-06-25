#!/usr/bin/env bash
# Dev-Postgres komplett zurücksetzen (wegwerfbar — nur Dev-Stack auf dem VPS).
set -euo pipefail

compose_dir="${1:-/opt/gwada-supabase-dev}"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

echo "→ Dev-Stack stoppen und Postgres-Volumes entfernen …"
docker compose down -v --remove-orphans 2>/dev/null || true

# Verwaiste gwada-dev-* Container (z. B. Kong mit blockiertem :8100)
if ids="$(docker ps -aq --filter name=gwada-dev-)"; then
  echo "→ Entferne verwaiste gwada-dev-Container …"
  docker rm -f ${ids} 2>/dev/null || true
fi

# Port 8100 freimachen (alter Kong o. ä.)
if ids="$(docker ps -q --filter publish=8100)"; then
  echo "→ Entferne Container auf Host-Port 8100 …"
  docker rm -f ${ids} 2>/dev/null || true
fi

rm -f "${compose_dir}/.secrets-rotated-after-leak"

echo "→ Dev-Stack neu starten …"
set +e
docker compose up -d
rc=$?
set -e
if [[ "${rc}" -ne 0 ]]; then
  echo "WARN: compose up fehlgeschlagen (rc=${rc}) — erneuter Versuch …" >&2
  docker rm -f gwada-dev-kong 2>/dev/null || true
  docker compose up -d
fi

for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose exec -T db pg_isready -U postgres

echo "→ Auth/REST mit frischer .env …"
docker compose up -d --force-recreate auth rest 2>/dev/null || docker compose up -d auth rest

for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:8100/auth/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

curl -sf "http://127.0.0.1:8100/auth/v1/health" >/dev/null \
  || { echo "FEHLER: Kong/Auth auf :8100 nicht erreichbar." >&2; exit 1; }

echo "✓ Dev-Postgres-Volume zurückgesetzt."
