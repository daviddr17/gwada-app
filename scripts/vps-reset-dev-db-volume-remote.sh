#!/usr/bin/env bash
# Dev-Postgres komplett zurücksetzen (wegwerfbar — nur Dev-Stack auf dem VPS).
set -euo pipefail

compose_dir="${1:-/opt/gwada-supabase-dev}"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

echo "→ Dev-Stack stoppen und Postgres-Volumes entfernen …"
docker compose down --remove-orphans 2>/dev/null || true
docker compose down -v --remove-orphans 2>/dev/null || true
docker rm -f gwada-dev-kong 2>/dev/null || true
rm -f "${compose_dir}/.secrets-rotated-after-leak"

echo "→ Dev-Stack neu starten …"
if ! docker compose up -d; then
  echo "WARN: compose up fehlgeschlagen — Port-Konflikt bereinigen …" >&2
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

echo "✓ Dev-Postgres-Volume zurückgesetzt."
