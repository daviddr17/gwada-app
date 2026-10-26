#!/usr/bin/env bash
# Dev-DB: schema_migrations lesbar machen (58P01 / Ownership). Nicht hart an ALTER OWNER scheitern.
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

# Versuche postgres, dann supabase_admin (je nach Owner der Tabelle).
psql_as() {
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

echo "→ Dev-DB: schema_migrations Health-Check …"

if readable supabase_admin || readable postgres; then
  owner="$(
    psql_as postgres -tAc \
      "select tableowner from pg_tables where schemaname='supabase_migrations' and tablename='schema_migrations';" \
      2>/dev/null | tr -d '[:space:]' || true
  )"
  count="$(
    if readable supabase_admin; then
      psql_as supabase_admin -tAc "select count(*) from supabase_migrations.schema_migrations;" | tr -d '[:space:]'
    else
      psql_as postgres -tAc "select count(*) from supabase_migrations.schema_migrations;" | tr -d '[:space:]'
    fi
  )"
  echo "✓ schema_migrations lesbar (owner=${owner:-?}, rows=${count})."
  # Best-effort Grants — Fehler ignorieren
  psql_as postgres -v ON_ERROR_STOP=0 -c \
    "grant usage, create on schema supabase_migrations to supabase_admin, postgres;
     grant all on table supabase_migrations.schema_migrations to supabase_admin, postgres;
     alter schema supabase_migrations owner to postgres;
     alter table if exists supabase_migrations.schema_migrations owner to postgres;" \
    >/dev/null 2>&1 || true
  exit 0
fi

echo "  unlesbar — Indexes droppen / Tabelle neu anlegen …"

# Indexes droppen (beide Rollen versuchen)
for user in postgres supabase_admin; do
  psql_as "${user}" -v ON_ERROR_STOP=0 -c "
    do \$\$
    declare r record;
    begin
      if to_regclass('supabase_migrations.schema_migrations') is null then
        return;
      end if;
      for r in
        select i.indexname
        from pg_indexes i
        where i.schemaname = 'supabase_migrations'
          and i.tablename = 'schema_migrations'
      loop
        begin
          execute format('drop index if exists supabase_migrations.%I cascade', r.indexname);
        exception when others then
          null;
        end;
      end loop;
    end
    \$\$;
  " >/dev/null 2>&1 || true
done

if readable supabase_admin || readable postgres; then
  echo "✓ schema_migrations nach Index-Drop wieder lesbar."
  exit 0
fi

echo "  DROP + CREATE als Owner-fähigem User …"
recreated=0
for user in supabase_admin postgres; do
  if psql_as "${user}" -v ON_ERROR_STOP=1 -c "
    create schema if not exists supabase_migrations;
    drop table if exists supabase_migrations.schema_migrations cascade;
    create table supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
    grant usage, create on schema supabase_migrations to postgres, supabase_admin;
    grant all on table supabase_migrations.schema_migrations to postgres, supabase_admin;
    alter schema supabase_migrations owner to postgres;
    alter table supabase_migrations.schema_migrations owner to postgres;
  " >/dev/null 2>&1; then
    recreated=1
    echo "  neu angelegt als ${user}"
    break
  fi
done

if (( recreated == 0 )); then
  echo "FEHLER: schema_migrations konnte nicht neu angelegt werden." >&2
  exit 1
fi

if readable supabase_admin || readable postgres; then
  echo "✓ schema_migrations neu initialisiert und lesbar."
  exit 0
fi

echo "FEHLER: schema_migrations nach Recreate weiterhin unlesbar." >&2
exit 1
