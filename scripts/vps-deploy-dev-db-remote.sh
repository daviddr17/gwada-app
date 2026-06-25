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
  psql_admin -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid();" 2>/dev/null || true

  drop_public_and_migrations() {
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
  }

  if ! drop_public_and_migrations; then
    echo "WARN: Schema-DROP fehlgeschlagen — Postgres neu starten …" >&2
    docker compose restart db
    for _ in $(seq 1 30); do
      docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && break
      sleep 2
    done
    docker compose exec -T db pg_isready -U postgres
    drop_public_and_migrations
  fi

  psql_exec -c "CREATE SCHEMA public;"
  psql_exec -c "GRANT ALL ON SCHEMA public TO postgres;"
  psql_exec -c "GRANT ALL ON SCHEMA public TO public;"
  psql_exec -c "GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;" 2>/dev/null || true
}

try_apply_migration() {
  local f="$1"
  local base version applied
  base="$(basename "${f}")"
  version="${base%.sql}"
  applied="$(psql_query "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${version}' LIMIT 1;" 2>/dev/null || true)"
  if [[ "${applied}" == "1" ]]; then
    return 1
  fi
  echo "→ ${base}"
  if psql_exec -f - < "${f}"; then
    psql_exec -c "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT DO NOTHING;"
    return 0
  fi
  echo "WARN: ${base} fehlgeschlagen — wird in nächstem Pass erneut versucht"
  return 1
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

  local pass=0 f applied_any pending max_passes=20
  while [[ "${pass}" -lt "${max_passes}" ]]; do
    pass=$((pass + 1))
    echo "=== Migrations pass ${pass}/${max_passes} ==="
    applied_any=0
    for f in "${files[@]}"; do
      if try_apply_migration "${f}"; then
        applied_any=1
      fi
    done
    pending="$(psql_query "SELECT ${#files[@]} - count(*) FROM supabase_migrations.schema_migrations;" 2>/dev/null || echo 1)"
    echo "Ausstehend: ${pending}"
    [[ "${pending}" == "0" ]] && break
    [[ "${applied_any}" -eq 0 ]] && break
  done

  pending="$(psql_query "SELECT ${#files[@]} - count(*) FROM supabase_migrations.schema_migrations;" 2>/dev/null || echo 1)"
  if [[ "${pending}" != "0" ]]; then
    echo "FEHLER: ${pending} Migration(en) nicht angewendet:" >&2
    for f in "${files[@]}"; do
      base="$(basename "${f}")"
      version="${base%.sql}"
      applied="$(psql_query "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '${version}' LIMIT 1;" 2>/dev/null || true)"
      [[ "${applied}" != "1" ]] && echo "  - ${base}" >&2
    done
    exit 1
  fi
}

has_platform_superadmins() {
  [[ "$(psql_query "SELECT to_regclass('public.platform_superadmins') IS NOT NULL;")" == "t" ]]
}

needs_dev_repair() {
  if ! has_restaurants; then
    return 0
  fi
  if ! has_platform_superadmins; then
    echo "WARN: Schema-Drift — restaurants ohne platform_superadmins" >&2
    return 0
  fi
  local demo_users
  demo_users="$(psql_query "SELECT count(*) FROM auth.users WHERE email = 'dreyer@techlion.de';" 2>/dev/null || echo 0)"
  [[ "${demo_users}" != "1" ]]
}

if [[ "${GWADA_FORCE_DEV_DB_RESET:-0}" == "1" ]] || needs_dev_repair; then
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
