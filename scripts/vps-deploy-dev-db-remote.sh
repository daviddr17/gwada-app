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

has_storage_buckets() {
  [[ "$(psql_query "SELECT to_regclass('storage.buckets') IS NOT NULL;")" == "t" ]]
}

has_restaurants() {
  [[ "$(psql_query "SELECT to_regclass('public.restaurants') IS NOT NULL;")" == "t" ]]
}

ensure_storage_schema() {
  if has_storage_buckets; then
    return
  fi
  echo "→ Storage-Schema bootstrap (SQL) …"
  if [[ -f /tmp/vps-bootstrap-dev-storage.sql ]]; then
    psql_admin -f - < /tmp/vps-bootstrap-dev-storage.sql
  else
    echo "WARN: /tmp/vps-bootstrap-dev-storage.sql fehlt — storage-Container starten …"
    docker compose up -d storage
    for _ in $(seq 1 15); do
      has_storage_buckets && return
      sleep 2
    done
  fi
  if ! has_storage_buckets; then
    echo "FEHLER: storage.buckets fehlt nach Bootstrap." >&2
    exit 1
  fi
  echo "✓ storage.buckets OK"
}

reset_dev_schemas() {
  echo "→ Dev-DB Schema-Reset (public + migration history, storage policies) …"
  psql_admin -c "DROP SCHEMA IF EXISTS supabase_migrations CASCADE;"
  psql_admin -c "DROP SCHEMA IF EXISTS public CASCADE;"
  psql_admin -c "
    DO \$\$ DECLARE r record; BEGIN
      IF to_regclass('storage.objects') IS NOT NULL THEN
        FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
        END LOOP;
      END IF;
    END \$\$;"
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

  local f base version applied
  for f in "${files[@]}"; do
    base="$(basename "${f}")"
    version="${base%.sql}"
    applied="$(psql_query "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${version}' LIMIT 1;" 2>/dev/null || true)"
    if [[ "${applied}" == "1" ]]; then
      echo "skip ${base}"
      continue
    fi
    echo "→ ${base}"
    psql_exec -f - < "${f}"
    psql_exec -c "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT DO NOTHING;"
  done
}

if [[ "${GWADA_FORCE_DEV_DB_RESET:-0}" == "1" ]] || ! has_restaurants; then
  reset_dev_schemas
fi

ensure_storage_schema

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
