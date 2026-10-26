#!/usr/bin/env bash
# Auf dem VPS: supabase db push via docker compose exec (localhost im DB-Container).
set -euo pipefail

compose_dir="$1"
mig_root="$2"
cli_dir="${3:-/tmp/supabase-cli}"
cli_version="${SUPABASE_CLI_VERSION:-2.105.0}"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

for i in $(seq 1 90); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose exec -T db pg_isready -U postgres

PW="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r\n')"
[[ -n "${PW}" ]] || PW="$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//' | tr -d '\r\n')"
ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${PW}")"
DB_CID="$(docker compose ps -q db)"
[[ -n "${DB_CID}" ]] || { echo "FEHLER: DB-Container fehlt." >&2; exit 1; }

docker exec "${DB_CID}" rm -rf /tmp/supabase-cli /tmp/migrations
docker cp "${mig_root}/." "${DB_CID}:/tmp/migrations/"

if [[ -d "${cli_dir}" ]] && [[ -x "${cli_dir}/supabase-go" ]]; then
  docker cp "${cli_dir}/." "${DB_CID}:/tmp/supabase-cli/"
  docker exec "${DB_CID}" chmod +x /tmp/supabase-cli/supabase /tmp/supabase-cli/supabase-go 2>/dev/null || true
else
  echo "→ Supabase CLI v${cli_version} im DB-Container laden …"
  docker exec "${DB_CID}" bash -c "
    set -euo pipefail
    mkdir -p /tmp/supabase-cli
    curl -fsSL 'https://github.com/supabase/cli/releases/download/v${cli_version}/supabase_${cli_version}_linux_amd64.tar.gz' \
      | tar -xzf - -C /tmp/supabase-cli
    chmod +x /tmp/supabase-cli/supabase /tmp/supabase-cli/supabase-go
  "
fi

DB_PORT="5435"
if ! docker compose exec -T -e PGPASSWORD="${PW}" db \
  psql -U supabase_admin -h localhost -p "${DB_PORT}" -d postgres -tAc 'select 1' >/dev/null 2>&1; then
  DB_PORT="5432"
fi

SUPABASE_BIN="/tmp/supabase-cli/supabase-go"
if ! docker exec "${DB_CID}" test -x "${SUPABASE_BIN}"; then
  SUPABASE_BIN="/tmp/supabase-cli/supabase"
fi

# Welcher DB-User kann schema_migrations lesen/schreiben?
DB_USER="supabase_admin"
if ! docker compose exec -T -e PGPASSWORD="${PW}" db \
  psql -U supabase_admin -h localhost -p "${DB_PORT}" -d postgres -tAc \
  "select count(*) from supabase_migrations.schema_migrations;" >/dev/null 2>&1; then
  if docker compose exec -T -e PGPASSWORD="${PW}" db \
    psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -tAc \
    "select count(*) from supabase_migrations.schema_migrations;" >/dev/null 2>&1; then
    DB_USER="postgres"
  fi
fi

psql_db() {
  docker compose exec -T -e PGPASSWORD="${PW}" db \
    psql -U "${DB_USER}" -h localhost -p "${DB_PORT}" -d postgres -v ON_ERROR_STOP=1 "$@"
}

DB_URL="postgresql://${DB_USER}:${ENC_PW}@127.0.0.1:${DB_PORT}/postgres?sslmode=disable"

if [[ -f /tmp/vps-dev-db-repair-missing-files.sh ]]; then
  if ! bash /tmp/vps-dev-db-repair-missing-files.sh "${compose_dir}" "${DB_PORT}" "${PW}"; then
    echo "  Repair-Skript meldete Fehler — Fallback-Recreate inline …" >&2
  fi
fi

ensure_schema_migrations_table() {
  local user="$1"
  # CREATE SCHEMA IF NOT EXISTS kann unique_violation werfen obwohl Schema existiert.
  # SQL via stdin — kein bash-Expand von Dollar-Quotes.
  docker compose exec -T -e PGPASSWORD="${PW}" db \
    psql -U "${user}" -h localhost -p "${DB_PORT}" -d postgres -v ON_ERROR_STOP=1 <<'SQL'
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
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
grant usage, create on schema supabase_migrations to postgres, supabase_admin;
grant all on table supabase_migrations.schema_migrations to postgres, supabase_admin;
SQL
}

# Ownership/Grants + Fallback falls Repair scheiterte.
echo "→ schema_migrations Ownership/Grants härten …"
if ! docker compose exec -T -e PGPASSWORD="${PW}" db \
  psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -v ON_ERROR_STOP=1 -tAc \
  "select count(*) from supabase_migrations.schema_migrations;" >/dev/null 2>&1; then
  echo "  Tabelle fehlt/unlesbar — inline recreate …"
  set +e
  ensure_schema_migrations_table postgres
  rc=$?
  if (( rc != 0 )); then
    ensure_schema_migrations_table supabase_admin
    rc=$?
  fi
  set -e
  if (( rc != 0 )); then
    echo "FEHLER: schema_migrations inline recreate fehlgeschlagen." >&2
    exit 1
  fi
fi
docker compose exec -T -e PGPASSWORD="${PW}" db \
  psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -v ON_ERROR_STOP=0 -c "
    grant usage, create on schema supabase_migrations to postgres, supabase_admin;
    grant all on all tables in schema supabase_migrations to postgres, supabase_admin;
    alter schema supabase_migrations owner to postgres;
    alter table if exists supabase_migrations.schema_migrations owner to postgres;
  " >/dev/null 2>&1 || true

# Push als postgres (Superuser) — vermeidet CLI CREATE-Permission-Fail.
DB_USER="postgres"
if docker compose exec -T -e PGPASSWORD="${PW}" db \
  psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -tAc \
  "select count(*) from supabase_migrations.schema_migrations;" >/dev/null 2>&1; then
  DB_USER="postgres"
elif docker compose exec -T -e PGPASSWORD="${PW}" db \
  psql -U supabase_admin -h localhost -p "${DB_PORT}" -d postgres -tAc \
  "select count(*) from supabase_migrations.schema_migrations;" >/dev/null 2>&1; then
  DB_USER="supabase_admin"
else
  echo "FEHLER: schema_migrations nach Harden weiterhin unlesbar." >&2
  exit 1
fi
DB_URL="postgresql://${DB_USER}:${ENC_PW}@127.0.0.1:${DB_PORT}/postgres?sslmode=disable"
echo "→ DB-User für Push: ${DB_USER}"

# Frische DB nach Volume-Reset: kein History-Seed — alle Migrationen wirklich anwenden.
FRESH_AFTER_RESET=0
if [[ -f /tmp/gwada-dev-volume-was-reset ]]; then
  FRESH_AFTER_RESET=1
fi
HAS_RESTAURANTS="$(
  docker compose exec -T -e PGPASSWORD="${PW}" db \
    psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -tAc \
    "select to_regclass('public.restaurants') is not null;" 2>/dev/null | tr -d '[:space:]' || echo f
)"

seed_applied_except_latest() {
  shopt -s nullglob
  local local_migs=("${mig_root}/supabase/migrations/"*.sql)
  ((${#local_migs[@]} > 0)) || return 0
  local IFS=$'\n'
  local sorted_migs=($(printf '%s\n' "${local_migs[@]}" | sort))
  unset IFS
  local sql="insert into supabase_migrations.schema_migrations (version, name) values"
  local first=1 i base ver name
  for ((i = 0; i < ${#sorted_migs[@]} - 1; i++)); do
    base="$(basename "${sorted_migs[$i]}")"
    ver="${base%%_*}"
    name="${base%.sql}"
    [[ -z "${ver}" ]] && continue
    if ((first)); then first=0; else sql+=","; fi
    sql+=$'\n'"  ('${ver}', '${name}')"
  done
  if ((first == 0)); then
    sql+=$'\n'"on conflict (version) do nothing;"
    echo "  SQL-seed applied (${#sorted_migs[@]} - 1 Versionen) als ${DB_USER} …"
    psql_db -c "${sql}"
  fi
  echo "  offen für db push: $(basename "${sorted_migs[-1]}")"
}

echo "→ Dev: Migration-History abgleichen …"
mapfile -t REMOTE_VERS < <(
  psql_db -tAc "select version from supabase_migrations.schema_migrations;" \
    2>/dev/null | tr -d '\r' || true
)

remote_count=0
for ver in "${REMOTE_VERS[@]+"${REMOTE_VERS[@]}"}"; do
  ver="${ver//[[:space:]]/}"
  [[ -n "${ver}" ]] && remote_count=$((remote_count + 1))
done

shopt -s nullglob
local_migs=("${mig_root}/supabase/migrations/"*.sql)

if (( FRESH_AFTER_RESET == 1 )) || [[ "${HAS_RESTAURANTS}" != "t" && "${HAS_RESTAURANTS}" != "true" ]]; then
  echo "  Frische Dev-DB (Volume-Reset oder kein public.restaurants) — kein History-Seed, alle Migrationen pushen."
  # Leere/teilweise History verwerfen, damit db push wirklich alles anwendet.
  psql_db -c "truncate supabase_migrations.schema_migrations;" 2>/dev/null || true
elif (( remote_count == 0 && ${#local_migs[@]} > 0 )); then
  echo "  schema_migrations leer, Schema existiert — seed außer letzter …"
  seed_applied_except_latest
else
  for ver in "${REMOTE_VERS[@]+"${REMOTE_VERS[@]}"}"; do
    ver="${ver//[[:space:]]/}"
    [[ -z "${ver}" ]] && continue
    matches=("${mig_root}/supabase/migrations/${ver}_"*.sql)
    if ((${#matches[@]} == 0)); then
      echo "  reverted (SQL): ${ver}"
      psql_db -c "delete from supabase_migrations.schema_migrations where version = '${ver}';"
    fi
  done
fi

echo "→ supabase db push (user=${DB_USER}, port=${DB_PORT}) …"
if ! docker compose exec -T -w /tmp/migrations db \
  env PGSSLMODE=disable \
  "${SUPABASE_BIN}" db push --db-url "${DB_URL}" --yes --include-all; then
  echo "  db push fehlgeschlagen — Retry als postgres mit Schema-CREATE …" >&2
  docker compose exec -T -e PGPASSWORD="${PW}" db \
    psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -v ON_ERROR_STOP=1 -c "
      grant usage, create on schema supabase_migrations to postgres, supabase_admin;
      alter schema supabase_migrations owner to postgres;
      alter table if exists supabase_migrations.schema_migrations owner to postgres;
      grant all on all tables in schema supabase_migrations to postgres, supabase_admin;
    "
  DB_USER="postgres"
  DB_URL="postgresql://postgres:${ENC_PW}@127.0.0.1:${DB_PORT}/postgres?sslmode=disable"
  docker compose exec -T -w /tmp/migrations db \
    env PGSSLMODE=disable \
    "${SUPABASE_BIN}" db push --db-url "${DB_URL}" --yes --include-all
fi