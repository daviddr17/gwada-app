#!/usr/bin/env bash
# Dev-DB: schema_migrations sicher anlegen/lesbar machen.
# Einzelne psql -c (kein Heredoc). Bei Catalog-Ghost → einmal Volume-Reset.
set -euo pipefail

compose_dir="${1:?compose_dir}"
db_port="${2:-5435}"
pw="${3:-}"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

if [[ -z "${pw}" ]]; then
  pw="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r\n')"
  [[ -n "${pw}" ]] || pw="$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//' | tr -d '\r\n')"
fi

# Socket (peer) zuerst, sonst TCP + Passwort.
psql_run() {
  local user="$1"
  shift
  local out rc
  set +e
  out="$(docker compose exec -T -e PGPASSWORD="${pw}" db \
    psql -U "${user}" -d postgres -v ON_ERROR_STOP=1 "$@" 2>&1)"
  rc=$?
  set -e
  if (( rc == 0 )); then
    printf '%s\n' "${out}"
    return 0
  fi
  set +e
  out="$(docker compose exec -T -e PGPASSWORD="${pw}" db \
    psql -U "${user}" -h localhost -p "${db_port}" -d postgres -v ON_ERROR_STOP=1 "$@" 2>&1)"
  rc=$?
  set -e
  printf '%s\n' "${out}"
  return "${rc}"
}

readable() {
  local user="$1"
  psql_run "${user}" -tAc "select count(*) from supabase_migrations.schema_migrations;" >/dev/null 2>&1
}

schema_exists() {
  local out
  out="$(psql_run postgres -tAc "select 1 from pg_namespace where nspname = 'supabase_migrations';" 2>/dev/null | tr -d '[:space:]' || true)"
  [[ "${out}" == "1" ]]
}

harden_grants() {
  psql_run postgres -c "grant usage, create on schema supabase_migrations to postgres, supabase_admin;" >/dev/null || true
  psql_run postgres -c "grant all on all tables in schema supabase_migrations to postgres, supabase_admin;" >/dev/null || true
  psql_run postgres -c "alter schema supabase_migrations owner to postgres;" >/dev/null || true
  psql_run postgres -c "alter table if exists supabase_migrations.schema_migrations owner to postgres;" >/dev/null || true
}

create_table_only() {
  local user="$1"
  psql_run "${user}" -c "create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"
  psql_run "${user}" -c "grant usage, create on schema supabase_migrations to postgres, supabase_admin;"
  psql_run "${user}" -c "grant all on table supabase_migrations.schema_migrations to postgres, supabase_admin;"
}

# 0=ok, 1=fail, 2=ghost (unique_violation ohne sichtbare Row)
create_schema_stmt() {
  local user="$1"
  local out rc
  set +e
  out="$(psql_run "${user}" -c "create schema supabase_migrations;" 2>&1)"
  rc=$?
  set -e
  if (( rc == 0 )); then
    echo "  Schema angelegt als ${user}"
    return 0
  fi
  if echo "${out}" | grep -qiE 'already exists|duplicate'; then
    if schema_exists; then
      echo "  Schema existiert bereits"
      return 0
    fi
    echo "  GHOST: Duplicate ohne pg_namespace-Row" >&2
    echo "${out}" | tail -8 >&2
    return 2
  fi
  echo "  CREATE SCHEMA (${user}) fehlgeschlagen:" >&2
  echo "${out}" | tail -12 >&2
  return 1
}

force_volume_reset_once() {
  if [[ -f /tmp/gwada-dev-schema-ghost-reset-done ]]; then
    echo "FEHLER: Catalog-Ghost nach Volume-Reset weiterhin." >&2
    exit 1
  fi
  if [[ ! -f /tmp/vps-reset-dev-db-volume-remote.sh ]]; then
    echo "FEHLER: /tmp/vps-reset-dev-db-volume-remote.sh fehlt." >&2
    exit 1
  fi
  echo "→ Catalog-Ghost: Dev Volume-Reset (einmalig) …" >&2
  touch /tmp/gwada-dev-schema-ghost-reset-done
  chmod +x /tmp/vps-reset-dev-db-volume-remote.sh /tmp/vps-provision-dev-supabase.sh 2>/dev/null || true
  bash /tmp/vps-reset-dev-db-volume-remote.sh "${compose_dir}"
  cd "${compose_dir}"
  export COMPOSE_PROJECT_NAME=gwada-dev
  touch /tmp/gwada-dev-volume-was-reset
  local i
  for i in $(seq 1 90); do
    docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 2
  done
  docker compose exec -T db pg_isready -U postgres
  # Frisches Passwort nach Reset
  pw="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r\n')"
  [[ -n "${pw}" ]] || pw="$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//' | tr -d '\r\n')"
}

echo "→ Dev-DB: schema_migrations Health-Check …"

if readable postgres || readable supabase_admin; then
  echo "✓ schema_migrations bereits lesbar."
  harden_grants
  exit 0
fi

echo "  unlesbar — Schema nur bei Bedarf, sonst nur Table …"
psql_run postgres -c "select nspname, pg_get_userbyid(nspowner) as owner from pg_namespace where nspname = 'supabase_migrations';" 2>&1 | tail -10 || true

if schema_exists; then
  echo "  Schema vorhanden — nur CREATE TABLE."
else
  set +e
  create_schema_stmt postgres
  rc=$?
  set -e
  if (( rc == 2 )); then
    force_volume_reset_once
    create_schema_stmt postgres || create_schema_stmt supabase_admin || true
  elif (( rc != 0 )); then
    set +e
    create_schema_stmt supabase_admin
    rc=$?
    set -e
    if (( rc == 2 )); then
      force_volume_reset_once
      create_schema_stmt postgres || true
    fi
  fi
fi

if ! schema_exists; then
  echo "  Schema fehlt weiter — Volume-Reset + CREATE …" >&2
  force_volume_reset_once
  create_schema_stmt postgres || create_schema_stmt supabase_admin || {
    echo "FEHLER: Schema nach Reset nicht anlegbar." >&2
    exit 1
  }
fi

echo "  CREATE TABLE schema_migrations …"
set +e
create_table_only postgres
trc=$?
if (( trc != 0 )); then
  create_table_only supabase_admin
  trc=$?
fi
set -e
if (( trc != 0 )); then
  echo "FEHLER: Table nicht anlegbar." >&2
  exit 1
fi

harden_grants

if readable postgres || readable supabase_admin; then
  echo "✓ schema_migrations neu initialisiert und lesbar."
  exit 0
fi

echo "FEHLER: schema_migrations nach CREATE weiterhin unlesbar." >&2
exit 1
