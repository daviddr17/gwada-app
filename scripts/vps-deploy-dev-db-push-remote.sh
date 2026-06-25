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

DB_URL="postgresql://supabase_admin:${ENC_PW}@127.0.0.1:${DB_PORT}/postgres?sslmode=disable"
SUPABASE_BIN="/tmp/supabase-cli/supabase-go"
if ! docker exec "${DB_CID}" test -x "${SUPABASE_BIN}"; then
  SUPABASE_BIN="/tmp/supabase-cli/supabase"
fi

echo "→ supabase db push (im DB-Container, localhost:${DB_PORT}) …"
docker compose exec -T -w /tmp/migrations db \
  env PGSSLMODE=disable \
  "${SUPABASE_BIN}" db push --db-url "${DB_URL}" --yes --include-all
