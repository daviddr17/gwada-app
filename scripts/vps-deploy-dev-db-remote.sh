#!/usr/bin/env bash
# Auf dem VPS: Dev-DB-Migrationen (Multi-Pass psql) + PostgREST-Reload.
# Kein automatisches Schema-DROP — bei kaputter DB: vps-reset-dev-db-volume-remote.sh
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

ensure_storage_schema

echo "→ Migrationen anwenden (psql, Multi-Pass) …"
apply_all_migrations

if ! has_restaurants; then
  echo "FEHLER: public.restaurants fehlt nach Migrationen." >&2
  echo "       Tipp: gh workflow run seed-dev-db.yml -f reset_volume=true" >&2
  exit 1
fi

echo "→ PostgREST Schema neu laden …"
psql_exec -c "NOTIFY pgrst, 'reload schema';" || true
docker compose restart rest
sleep 4

mig_count="$(psql_query "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
echo "✓ Dev-DB-Migrationen angewendet (${mig_count} Migrationen, restaurants OK)."
