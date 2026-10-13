#!/usr/bin/env bash
# Dev-DB: fehlende Relation-Dateien (SQLSTATE 58P01) + schema_migrations Ownership reparieren.
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

# postgres-Superuser für DDL/OWNER; supabase_admin für App-CLI
psql_postgres() {
  docker compose exec -T -e PGPASSWORD="${pw}" db \
    psql -U postgres -h localhost -p "${db_port}" -d postgres -v ON_ERROR_STOP=1 "$@"
}

psql_admin() {
  docker compose exec -T -e PGPASSWORD="${pw}" db \
    psql -U supabase_admin -h localhost -p "${db_port}" -d postgres -v ON_ERROR_STOP=1 "$@"
}

echo "→ Dev-DB: prüfe auf fehlende Relation-Dateien (base/<dboid>/<relfilenode>) …"

mapfile -t MISSING < <(
  docker compose exec -T -e PGPASSWORD="${pw}" db bash -c "
    set -euo pipefail
    DB_OID=\$(psql -U postgres -h localhost -p '${db_port}' -d postgres -tAc \"select oid from pg_database where datname = 'postgres'\" | tr -d '[:space:]')
    DATA_DIR=\$(psql -U postgres -h localhost -p '${db_port}' -d postgres -tAc 'show data_directory' | tr -d '[:space:]')
    psql -U postgres -h localhost -p '${db_port}' -d postgres -tAc \"
      select c.oid::text || '|' || n.nspname || '|' || c.relname || '|' || c.relkind::text || '|' || c.relfilenode::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relfilenode <> 0
        and n.nspname not in ('pg_catalog', 'information_schema')
        and n.nspname not like 'pg_toast%'
      order by 1;
    \" | tr -d '\r' | while IFS='|' read -r oid nsp name kind node; do
      [[ -z \"\${node:-}\" ]] && continue
      f=\"\${DATA_DIR}/base/\${DB_OID}/\${node}\"
      if [[ ! -e \"\$f\" ]]; then
        echo \"\${oid}|\${nsp}|\${name}|\${kind}|\${node}\"
      fi
    done
  " | tr -d '\r'
)

for row in "${MISSING[@]+"${MISSING[@]}"}"; do
  [[ -z "${row//[[:space:]]/}" ]] && continue
  IFS='|' read -r oid nsp name kind node <<<"${row}"
  echo "  fehlt: ${nsp}.${name} (kind=${kind}, oid=${oid}, relfilenode=${node})"
  case "${kind}" in
    i|I)
      echo "  → DROP INDEX ${nsp}.${name}"
      psql_postgres -c "DROP INDEX IF EXISTS ${nsp}.\"${name}\" CASCADE;" || true
      ;;
    r)
      if [[ "${nsp}" == "supabase_migrations" && "${name}" == "schema_migrations" ]]; then
        echo "  → schema_migrations Heap fehlt — Tabelle neu anlegen"
        psql_postgres -c "
          drop table if exists supabase_migrations.schema_migrations cascade;
        "
      else
        echo "  WARN: Tabellen-Datei fehlt (${nsp}.${name}) — manueller Eingriff nötig." >&2
      fi
      ;;
    t|T)
      echo "  → Toast-Relation ${nsp}.${name} (kind=${kind}) — Parent-Tabelle ggf. neu anlegen"
      ;;
    *)
      echo "  WARN: unbekannter relkind=${kind} für ${nsp}.${name}" >&2
      ;;
  esac
done

ensure_schema_migrations() {
  psql_postgres -c "
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
    alter table supabase_migrations.schema_migrations owner to postgres;
    grant usage on schema supabase_migrations to postgres, supabase_admin;
    grant all on table supabase_migrations.schema_migrations to postgres, supabase_admin;
    -- CLI (supabase_admin) muss Owner sein für migration repair / ensure table
    alter table supabase_migrations.schema_migrations owner to supabase_admin;
  "
}

# Lesbarkeit prüfen (auch ohne ORDER BY — kaputter Index)
if ! psql_admin -tAc "select version from supabase_migrations.schema_migrations limit 1;" >/dev/null 2>&1; then
  echo "  schema_migrations unlesbar oder fehlend — neu initialisieren …"
  # Kaputte Indexes droppen falls Heap noch da
  psql_postgres -c "
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
          raise notice 'index drop skip: %', sqlerrm;
        end;
      end loop;
    end
    \$\$;
  " >/dev/null 2>&1 || true

  if ! psql_admin -tAc "select version from supabase_migrations.schema_migrations limit 1;" >/dev/null 2>&1; then
    echo "  DROP + CREATE schema_migrations …"
    psql_postgres -c "drop table if exists supabase_migrations.schema_migrations cascade;"
  fi
fi

ensure_schema_migrations

# Ownership/Grants immer sicherstellen (auch wenn Tabelle schon ok war)
psql_postgres -c "
  alter table if exists supabase_migrations.schema_migrations owner to supabase_admin;
  grant all on table supabase_migrations.schema_migrations to supabase_admin, postgres;
" >/dev/null

if psql_admin -tAc "select 1 from supabase_migrations.schema_migrations limit 1;" >/dev/null 2>&1 \
  || psql_admin -tAc "select count(*) from supabase_migrations.schema_migrations;" >/dev/null 2>&1; then
  count="$(psql_admin -tAc "select count(*) from supabase_migrations.schema_migrations;" | tr -d '[:space:]')"
  echo "✓ schema_migrations ok (rows=${count}, owner=supabase_admin)."
else
  echo "FEHLER: schema_migrations nach Repair weiterhin unlesbar." >&2
  exit 1
fi
