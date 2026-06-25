#!/usr/bin/env bash
# Auf dem VPS: Dev-DB-Migrationen (Multi-Pass psql) + PostgREST-Reload.
# Kein automatisches Schema-DROP — bei kaputter DB: vps-reset-dev-db-volume-remote.sh
set -euo pipefail

compose_dir="$1"
mig_root="$2"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

dev_compose_services() {
  docker compose config --services 2>/dev/null | grep -Ev '^(supavisor|pooler)$' || true
}

quiesce_dev_stack_for_migrations() {
  echo "→ Dev-Stack pausieren (nur Postgres für Migrationen) …"
  docker compose stop 2>/dev/null || true
  docker compose up -d db
  for i in $(seq 1 60); do
    if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  docker compose exec -T db pg_isready -U postgres
  psql_admin_quiet() {
    docker compose exec -T db psql -U supabase_admin -v ON_ERROR_STOP=1 "$@"
  }
  psql_admin_quiet -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();" 2>/dev/null || true
}

restore_dev_stack_after_migrations() {
  echo "→ Dev-Stack wieder starten …"
  mapfile -t DEV_SERVICES < <(dev_compose_services)
  if [[ ${#DEV_SERVICES[@]} -gt 0 ]]; then
    docker compose up -d "${DEV_SERVICES[@]}"
  else
    docker compose up -d
  fi
}

quiesce_dev_stack_for_migrations

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

psql_query_safe() {
  docker compose exec -T db psql -U postgres -tAc "$1" 2>/dev/null || true
}

has_storage_buckets() {
  [[ "$(psql_query "SELECT to_regclass('storage.buckets') IS NOT NULL;")" == "t" ]]
}

ensure_storage_schema() {
  if has_storage_buckets; then
    return
  fi
  echo "→ Storage-Schema bootstrap (SQL) …"
  if [[ -f /tmp/vps-bootstrap-dev-storage.sql ]]; then
    psql_admin -f - < /tmp/vps-bootstrap-dev-storage.sql
  else
    echo "FEHLER: /tmp/vps-bootstrap-dev-storage.sql fehlt — Storage-Bootstrap ohne laufende Services." >&2
    exit 1
  fi
  if ! has_storage_buckets; then
    echo "FEHLER: storage.buckets fehlt nach Bootstrap." >&2
    exit 1
  fi
  echo "✓ storage.buckets OK"
}

has_restaurants() {
  [[ "$(psql_query "SELECT to_regclass('public.restaurants') IS NOT NULL;")" == "t" ]]
}

initial_migration_applied() {
  [[ "$(psql_query_safe "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20250517140000' LIMIT 1;")" == "1" ]]
}

prepare_public_schema_for_gwada() {
  local mig_count
  mig_count="$(psql_query_safe "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
  mig_count="${mig_count:-0}"

  if initial_migration_applied && has_restaurants; then
    return
  fi

  # Frische Dev-DB: Supabase-Docker legt public.profiles an — initial migration droppt sie selbst.
  if [[ "${mig_count}" == "0" ]]; then
    return
  fi

  if ! has_restaurants; then
    echo "FEHLER: kaputte Dev-DB (${mig_count} Migrationen, public.restaurants fehlt)." >&2
    echo "       Nur Volume-Reset: pnpm repair:dev (reset_volume=true)" >&2
    exit 1
  fi
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

  local pass=0 f applied_any pending max_passes=30
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

prepare_public_schema_for_gwada
ensure_storage_schema

echo "→ Migrationen anwenden (psql, Multi-Pass) …"
apply_all_migrations

if ! has_restaurants; then
  echo "FEHLER: public.restaurants fehlt nach Migrationen." >&2
  echo "       Tipp: gh workflow run seed-dev-db.yml -f reset_volume=true" >&2
  exit 1
fi

echo "→ PostgREST Schema neu laden …"
restore_dev_stack_after_migrations
psql_exec -c "NOTIFY pgrst, 'reload schema';" || true
docker compose restart rest auth
sleep 6

mig_count="$(psql_query "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
echo "✓ Dev-DB-Migrationen angewendet (${mig_count} Migrationen, restaurants OK)."
