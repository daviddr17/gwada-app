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
  bash /tmp/vps-dev-db-repair-missing-files.sh "${compose_dir}" "${DB_PORT}" "${PW}"
fi

# Nach Repair erneut User wählen
if docker compose exec -T -e PGPASSWORD="${PW}" db \
  psql -U supabase_admin -h localhost -p "${DB_PORT}" -d postgres -tAc \
  "select count(*) from supabase_migrations.schema_migrations;" >/dev/null 2>&1; then
  DB_USER="supabase_admin"
elif docker compose exec -T -e PGPASSWORD="${PW}" db \
  psql -U postgres -h localhost -p "${DB_PORT}" -d postgres -tAc \
  "select count(*) from supabase_migrations.schema_migrations;" >/dev/null 2>&1; then
  DB_USER="postgres"
fi
DB_URL="postgresql://${DB_USER}:${ENC_PW}@127.0.0.1:${DB_PORT}/postgres?sslmode=disable"
echo "→ DB-User für Push: ${DB_USER}"

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

if (( remote_count == 0 && ${#local_migs[@]} > 0 )); then
  echo "  schema_migrations leer — seed außer letzter …"
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
docker compose exec -T -w /tmp/migrations db \
  env PGSSLMODE=disable \
  "${SUPABASE_BIN}" db push --db-url "${DB_URL}" --yes --include-all
