#!/usr/bin/env bash
# Auf dem VPS: Dev-DB Migrationen via supabase db push.
# Kaputte schema_migrations / fehlendes Schema → Volume-Reset + frischer Stack.
# Danach immer Push als postgres (volle Rechte). Keine Ghost-/IF-NOT-EXISTS-Logik.
set -euo pipefail

compose_dir="$1"
mig_root="$2"
cli_dir="${3:-/tmp/supabase-cli}"
cli_version="${SUPABASE_CLI_VERSION:-2.105.0}"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

wait_db() {
  local i
  for i in $(seq 1 90); do
    if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  docker compose exec -T db pg_isready -U postgres
}

wait_db

PW="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r\n')"
[[ -n "${PW}" ]] || PW="$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//' | tr -d '\r\n')"
refresh_pw() {
  PW="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r\n')"
  [[ -n "${PW}" ]] || PW="$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//' | tr -d '\r\n')"
  ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${PW}")"
}
refresh_pw

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
  psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -tAc 'select 1' >/dev/null 2>&1; then
  DB_PORT="5432"
fi

SUPABASE_BIN="/tmp/supabase-cli/supabase-go"
if ! docker exec "${DB_CID}" test -x "${SUPABASE_BIN}"; then
  SUPABASE_BIN="/tmp/supabase-cli/supabase"
fi

psql_postgres() {
  docker compose exec -T -e PGPASSWORD="${PW}" db \
    psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -v ON_ERROR_STOP=1 "$@"
}

psql_postgres_ok() {
  docker compose exec -T -e PGPASSWORD="${PW}" db \
    psql -U postgres -h localhost -p "${DB_PORT}" -d postgres "$@" >/dev/null 2>&1
}

migrations_readable() {
  psql_postgres_ok -tAc "select count(*) from supabase_migrations.schema_migrations;"
}

has_restaurants() {
  local v
  v="$(docker compose exec -T -e PGPASSWORD="${PW}" db \
    psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -tAc \
    "select to_regclass('public.restaurants') is not null;" 2>/dev/null | tr -d '[:space:]' || echo f)"
  [[ "${v}" == "t" || "${v}" == "true" ]]
}

# Kaputt = History unlesbar ODER Gwada-Schema fehlt (frische/korrupte DB).
dev_db_broken() {
  if ! migrations_readable; then
    return 0
  fi
  if ! has_restaurants; then
    return 0
  fi
  return 1
}

reset_dev_volume() {
  echo "→ Dev-DB kaputt/unbrauchbar — Volume-Reset + frischer Stack …"
  if [[ ! -f /tmp/vps-reset-dev-db-volume-remote.sh || ! -f /tmp/vps-provision-dev-supabase.sh ]]; then
    echo "FEHLER: Reset-/Provision-Skripte fehlen unter /tmp." >&2
    exit 1
  fi
  chmod +x /tmp/vps-reset-dev-db-volume-remote.sh /tmp/vps-provision-dev-supabase.sh
  [[ -f /tmp/vps-refresh-dev-env.sh ]] && chmod +x /tmp/vps-refresh-dev-env.sh || true
  rm -f /tmp/gwada-dev-schema-ghost-reset-done
  bash /tmp/vps-reset-dev-db-volume-remote.sh "${compose_dir}"
  cd "${compose_dir}"
  export COMPOSE_PROJECT_NAME=gwada-dev
  touch /tmp/gwada-dev-volume-was-reset
  wait_db
  refresh_pw
  DB_CID="$(docker compose ps -q db)"
  [[ -n "${DB_CID}" ]] || { echo "FEHLER: DB-Container nach Reset fehlt." >&2; exit 1; }
  # CLI + Migrationen nach Reset erneut in den neuen Container
  docker exec "${DB_CID}" rm -rf /tmp/supabase-cli /tmp/migrations
  docker cp "${mig_root}/." "${DB_CID}:/tmp/migrations/"
  docker cp "${cli_dir}/." "${DB_CID}:/tmp/supabase-cli/" 2>/dev/null \
    || docker exec "${DB_CID}" bash -c "
      set -euo pipefail
      mkdir -p /tmp/supabase-cli
      curl -fsSL 'https://github.com/supabase/cli/releases/download/v${cli_version}/supabase_${cli_version}_linux_amd64.tar.gz' \
        | tar -xzf - -C /tmp/supabase-cli
      chmod +x /tmp/supabase-cli/supabase /tmp/supabase-cli/supabase-go
    "
  docker exec "${DB_CID}" chmod +x /tmp/supabase-cli/supabase /tmp/supabase-cli/supabase-go 2>/dev/null || true
  if ! docker compose exec -T -e PGPASSWORD="${PW}" db \
    psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -tAc 'select 1' >/dev/null 2>&1; then
    DB_PORT="5432"
  fi
  echo "✓ Dev-DB nach Volume-Reset bereit."
}

ensure_migrations_table_fresh() {
  # Frische DB nach Reset: Schema+Table als postgres. Ein Statement nach dem anderen.
  echo "→ schema_migrations als postgres anlegen …"
  psql_postgres_ok -c "create schema supabase_migrations;" || true
  psql_postgres -c "create table if not exists supabase_migrations.schema_migrations (
    version text primary key,
    statements text[],
    name text
  );"
  psql_postgres_ok -c "grant usage, create on schema supabase_migrations to postgres, supabase_admin;" || true
  psql_postgres_ok -c "grant all on table supabase_migrations.schema_migrations to postgres, supabase_admin;" || true
  if ! migrations_readable; then
    echo "FEHLER: schema_migrations nach frischem CREATE weiterhin unlesbar." >&2
    exit 1
  fi
  echo "✓ schema_migrations lesbar (postgres)."
}

FRESH=0
if [[ -f /tmp/gwada-dev-volume-was-reset ]]; then
  FRESH=1
fi

if dev_db_broken; then
  echo "→ Health: schema_migrations und/oder public.restaurants nicht ok."
  reset_dev_volume
  FRESH=1
  ensure_migrations_table_fresh
elif ! migrations_readable; then
  ensure_migrations_table_fresh
  FRESH=1
else
  echo "✓ schema_migrations lesbar — inkrementeller Push."
fi

DB_USER="postgres"
DB_URL="postgresql://postgres:${ENC_PW}@127.0.0.1:${DB_PORT}/postgres?sslmode=disable"
echo "→ DB-User für Push: ${DB_USER} (port=${DB_PORT})"

psql_db() {
  docker compose exec -T -e PGPASSWORD="${PW}" db \
    psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -v ON_ERROR_STOP=1 "$@"
}

echo "→ Dev: Migration-History …"
if (( FRESH == 1 )); then
  echo "  Frische Dev-DB — kein History-Seed, alle Migrationen pushen."
  psql_db -c "truncate supabase_migrations.schema_migrations;" 2>/dev/null || true
else
  # Nur Remote-Versionen ohne lokale Datei entfernen (Repair), sonst unverändert pushen.
  mapfile -t REMOTE_VERS < <(
    psql_db -tAc "select version from supabase_migrations.schema_migrations;" \
      2>/dev/null | tr -d '\r' || true
  )
  for ver in "${REMOTE_VERS[@]+"${REMOTE_VERS[@]}"}"; do
    ver="${ver//[[:space:]]/}"
    [[ -z "${ver}" ]] && continue
    shopt -s nullglob
    matches=("${mig_root}/supabase/migrations/${ver}_"*.sql)
    shopt -u nullglob
    if ((${#matches[@]} == 0)); then
      echo "  reverted (SQL): ${ver}"
      psql_db -c "delete from supabase_migrations.schema_migrations where version = '${ver}';"
    fi
  done
fi

echo "→ supabase db push (user=postgres, port=${DB_PORT}) …"
docker compose exec -T -w /tmp/migrations db \
  env PGSSLMODE=disable \
  "${SUPABASE_BIN}" db push --db-url "${DB_URL}" --yes --include-all

echo "✓ Dev-DB Migrationen angewendet."
