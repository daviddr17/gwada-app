#!/usr/bin/env bash
# Auf dem VPS ausführen: Dev-DB-Migrationen + PostgREST-Reload.
set -euo pipefail

compose_dir="$1"
mig_root="$2"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose exec -T db pg_isready -U postgres

psql_exec() {
  docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 "$@"
}

psql_admin() {
  docker compose exec -T db psql -U supabase_admin -v ON_ERROR_STOP=1 "$@"
}

psql_query() {
  psql_exec -tAc "$1"
}

has_restaurants() {
  [[ "$(psql_query "SELECT to_regclass('public.restaurants') IS NOT NULL;")" == "t" ]]
}

reset_dev_schemas() {
  echo "→ Dev-DB Schema-Reset (public + storage + migration history) …"
  psql_admin -c "DROP SCHEMA IF EXISTS supabase_migrations CASCADE;"
  psql_admin -c "DROP SCHEMA IF EXISTS storage CASCADE;"
  psql_admin -c "DROP SCHEMA IF EXISTS public CASCADE;"
  psql_exec -c "CREATE SCHEMA public;"
  psql_exec -c "GRANT ALL ON SCHEMA public TO postgres;"
  psql_exec -c "GRANT ALL ON SCHEMA public TO public;"
  psql_exec -c "GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;" 2>/dev/null || true
}

apply_all_migrations() {
  local mig_dir="${mig_root}/supabase/migrations"
  shopt -s nullglob
  local files=("${mig_dir}"/*.sql)
  shopt -u nullglob
  [[ ${#files[@]} -gt 0 ]] || { echo "FEHLER: keine Migrationen unter ${mig_dir}" >&2; exit 1; }

  psql_exec -c "CREATE SCHEMA IF NOT EXISTS supabase_migrations;"
  psql_exec -c "CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version text PRIMARY KEY
  );"

  local f base version
  for f in "${files[@]}"; do
    base="$(basename "${f}")"
    version="${base%.sql}"
    echo "→ ${base}"
    psql_exec -f - < "${f}"
    psql_exec -c "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT DO NOTHING;"
  done
}

if [[ "${GWADA_FORCE_DEV_DB_RESET:-0}" == "1" ]] || ! has_restaurants; then
  reset_dev_schemas
fi

echo "→ Migrationen anwenden (psql) …"
apply_all_migrations

if ! has_restaurants; then
  echo "FEHLER: public.restaurants fehlt nach Migrationen." >&2
  exit 1
fi

echo "→ PostgREST Schema neu laden …"
psql_exec -c "NOTIFY pgrst, 'reload schema';" || true
docker compose restart rest
sleep 4

mig_count="$(psql_query "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
echo "✓ Dev-DB-Migrationen angewendet (${mig_count} Migrationen, restaurants OK)."
