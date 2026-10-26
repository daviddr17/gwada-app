#!/usr/bin/env bash
# Dev-DB: schema_migrations lesbar machen (58P01 / Ownership / leeres Schema).
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

psql_as() {
  local user="$1"
  shift
  docker compose exec -T -e PGPASSWORD="${pw}" db \
    psql -U "${user}" -h localhost -p "${db_port}" -d postgres "$@"
}

# SQL via stdin (kein bash-Expand von $…$ Dollar-Quotes).
psql_as_stdin() {
  local user="$1"
  shift
  docker compose exec -T -e PGPASSWORD="${pw}" db \
    psql -U "${user}" -h localhost -p "${db_port}" -d postgres "$@"
}

readable() {
  local user="$1"
  psql_as "${user}" -v ON_ERROR_STOP=1 -tAc \
    "select count(*) from supabase_migrations.schema_migrations;" >/dev/null 2>&1
}

harden_grants() {
  psql_as postgres -v ON_ERROR_STOP=0 -c \
    "grant usage, create on schema supabase_migrations to postgres, supabase_admin; grant all on all tables in schema supabase_migrations to postgres, supabase_admin; alter schema supabase_migrations owner to postgres; alter table if exists supabase_migrations.schema_migrations owner to postgres;" \
    2>&1 | tail -5 || true
}

recreate_schema_migrations() {
  local user="$1"
  # CREATE SCHEMA IF NOT EXISTS kann unique_violation werfen obwohl Schema existiert.
  psql_as_stdin "${user}" -v ON_ERROR_STOP=1 <<'SQL'
do $ensure$
begin
  if not exists (select 1 from pg_namespace where nspname = 'supabase_migrations') then
    create schema supabase_migrations;
  end if;
exception
  when duplicate_object then null;
  when unique_violation then null;
end
$ensure$;

drop table if exists supabase_migrations.schema_migrations cascade;

create table supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);

grant usage, create on schema supabase_migrations to postgres, supabase_admin;
grant all on table supabase_migrations.schema_migrations to postgres, supabase_admin;
SQL
}

echo "→ Dev-DB: schema_migrations Health-Check …"

if readable supabase_admin || readable postgres; then
  owner="$(
    psql_as postgres -tAc \
      "select tableowner from pg_tables where schemaname='supabase_migrations' and tablename='schema_migrations';" \
      2>/dev/null | tr -d '[:space:]' || true
  )"
  count="$(
    if readable postgres; then
      psql_as postgres -tAc "select count(*) from supabase_migrations.schema_migrations;" | tr -d '[:space:]'
    else
      psql_as supabase_admin -tAc "select count(*) from supabase_migrations.schema_migrations;" | tr -d '[:space:]'
    fi
  )"
  echo "✓ schema_migrations lesbar (owner=${owner:-?}, rows=${count})."
  harden_grants
  exit 0
fi

echo "  unlesbar — Diagnose + Recreate …"
psql_as postgres -v ON_ERROR_STOP=0 -c \
  "select nspname, pg_get_userbyid(nspowner) as owner from pg_namespace where nspname = 'supabase_migrations';" \
  2>&1 | tail -20 || true
psql_as postgres -v ON_ERROR_STOP=0 -c \
  "select n.nspname, c.relname, pg_get_userbyid(c.relowner) as owner from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'supabase_migrations';" \
  2>&1 | tail -20 || true

for user in postgres supabase_admin; do
  psql_as "${user}" -v ON_ERROR_STOP=0 -c \
    "do \$\$ declare r record; begin if to_regclass('supabase_migrations.schema_migrations') is null then return; end if; for r in select i.indexname from pg_indexes i where i.schemaname = 'supabase_migrations' and i.tablename = 'schema_migrations' loop begin execute format('drop index if exists supabase_migrations.%I cascade', r.indexname); exception when others then null; end; end loop; end \$\$;" \
    >/dev/null 2>&1 || true
done

if readable supabase_admin || readable postgres; then
  echo "✓ schema_migrations nach Index-Drop wieder lesbar."
  harden_grants
  exit 0
fi

echo "  DROP + CREATE Tabelle (Schema Exception-sicher) …"
recreated=0
last_err=""
for user in postgres supabase_admin; do
  echo "  Versuch als ${user} …"
  set +e
  out="$(recreate_schema_migrations "${user}" 2>&1)"
  rc=$?
  set -e
  if (( rc == 0 )); then
    recreated=1
    echo "  neu angelegt als ${user}"
    echo "${out}" | tail -5
    break
  fi
  last_err="${out}"
  echo "  ${user} fehlgeschlagen:" >&2
  echo "${out}" | tail -30 >&2
done

if (( recreated == 0 )); then
  echo "FEHLER: schema_migrations konnte nicht neu angelegt werden." >&2
  echo "${last_err}" | tail -40 >&2
  exit 1
fi

harden_grants

if readable supabase_admin || readable postgres; then
  echo "✓ schema_migrations neu initialisiert und lesbar."
  exit 0
fi

echo "FEHLER: schema_migrations nach Recreate weiterhin unlesbar." >&2
exit 1
