#!/usr/bin/env bash
# Dev-DB: fehlende Relation-Dateien (SQLSTATE 58P01 / base/<db>/<relfilenode>) reparieren.
# Läuft im VPS-Kontext mit compose_dir als CWD-Argument.
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

psql_admin() {
  docker compose exec -T -e PGPASSWORD="${pw}" db \
    psql -U supabase_admin -h localhost -p "${db_port}" -d postgres -v ON_ERROR_STOP=1 "$@"
}

echo "→ Dev-DB: prüfe auf fehlende Relation-Dateien (base/<dboid>/<relfilenode>) …"

# postgres-DB-OID (meist 5) + alle User-Relationen mit Datei-Check im Container
mapfile -t MISSING < <(
  docker compose exec -T -e PGPASSWORD="${pw}" db bash -c "
    set -euo pipefail
    DB_OID=\$(psql -U supabase_admin -h localhost -p '${db_port}' -d postgres -tAc \"select oid from pg_database where datname = 'postgres'\")
    DATA_DIR=\$(psql -U supabase_admin -h localhost -p '${db_port}' -d postgres -tAc 'show data_directory' | tr -d '[:space:]')
    psql -U supabase_admin -h localhost -p '${db_port}' -d postgres -tAc \"
      select c.oid || '|' || n.nspname || '|' || c.relname || '|' || c.relkind || '|' || c.relfilenode
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relfilenode <> 0
        and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
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

if ((${#MISSING[@]} == 0)); then
  echo "  keine fehlenden User-Relation-Dateien gefunden."
  # Trotzdem Migration-History lesbar?
  if psql_admin -tAc "select count(*) from supabase_migrations.schema_migrations;" >/dev/null 2>&1; then
    echo "  schema_migrations lesbar."
    exit 0
  fi
  echo "  schema_migrations weiterhin unlesbar — Index-/Toast-Reparatur versuchen …"
fi

for row in "${MISSING[@]+"${MISSING[@]}"}"; do
  [[ -z "${row//[[:space:]]/}" ]] && continue
  IFS='|' read -r oid nsp name kind node <<<"${row}"
  echo "  fehlt: ${nsp}.${name} (kind=${kind}, oid=${oid}, relfilenode=${node})"
  case "${kind}" in
    i|I)
      echo "  → DROP INDEX ${nsp}.${name}"
      psql_admin -c "DROP INDEX IF EXISTS ${nsp}.\"${name}\";" || true
      ;;
    r)
      if [[ "${nsp}" == "supabase_migrations" && "${name}" == "schema_migrations" ]]; then
        echo "  → schema_migrations Heap fehlt — Tabelle neu anlegen (Versionsliste folgt aus lokalen Dateien)."
        psql_admin -c "
          drop table if exists supabase_migrations.schema_migrations cascade;
          create table supabase_migrations.schema_migrations (
            version text primary key,
            statements text[],
            name text
          );
        "
      else
        echo "  WARN: Tabellen-Datei fehlt (${nsp}.${name}) — manueller Eingriff nötig." >&2
      fi
      ;;
    t|T)
      echo "  → Toast/Index ${nsp}.${name} droppen falls möglich"
      psql_admin -c "DROP INDEX IF EXISTS ${nsp}.\"${name}\";" 2>/dev/null || true
      ;;
    *)
      echo "  WARN: unbekannter relkind=${kind} für ${nsp}.${name}" >&2
      ;;
  esac
done

# Wenn schema_migrations existiert aber ORDER BY / Index kaputt: Indexes droppen
psql_admin -c "
  do \$\$
  declare r record;
  begin
    for r in
      select i.indexname
      from pg_indexes i
      where i.schemaname = 'supabase_migrations'
        and i.tablename = 'schema_migrations'
    loop
      begin
        execute format('drop index if exists supabase_migrations.%I', r.indexname);
      exception when others then
        raise notice 'index drop skip: %', sqlerrm;
      end;
    end loop;
  end
  \$\$;
" >/dev/null 2>&1 || true

# Lesbarkeit erneut prüfen
if ! psql_admin -tAc "select version from supabase_migrations.schema_migrations limit 1;" >/dev/null 2>&1; then
  echo "  schema_migrations neu initialisieren …"
  psql_admin -c "
    create schema if not exists supabase_migrations;
    drop table if exists supabase_migrations.schema_migrations cascade;
    create table supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  "
fi

echo "✓ Dev-DB Missing-File-Repair abgeschlossen."
