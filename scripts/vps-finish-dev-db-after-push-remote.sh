#!/usr/bin/env bash
# Nach db push: Dev-Stack hochfahren, Auth/REST neu laden.
set -euo pipefail

compose_dir="${1:-/opt/gwada-supabase-dev}"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

for i in $(seq 1 90); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose exec -T db pg_isready -U postgres

echo "→ Dev-Stack hochfahren …"
mapfile -t DEV_SERVICES < <(docker compose config --services | grep -Ev '^(supavisor|pooler)$' || true)
docker compose up -d "${DEV_SERVICES[@]}"

echo "→ PostgREST + GoTrue neu laden …"
docker compose exec -T db psql -U postgres -c "NOTIFY pgrst, 'reload schema';" 2>/dev/null || true
docker compose up -d --force-recreate auth rest 2>/dev/null || docker compose restart auth rest
sleep 8

mig_count="$(docker compose exec -T db psql -U postgres -tAc "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
echo "✓ Dev-DB-Migrationen angewendet (${mig_count} Migrationen)."
