#!/usr/bin/env bash
# Auf dem VPS ausführen: Dev-DB-Migrationen + PostgREST-Reload.
set -euo pipefail

compose_dir="$1"
network="$2"
mig_root="$3"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose exec -T db pg_isready -U postgres

PW="$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//' | tr -d '\r\n')"
ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${PW}")"
DB_PORT="$(grep -m1 '^POSTGRES_PORT=' .env | sed 's/^POSTGRES_PORT=//' | tr -d '\r\n')"
DB_PORT="${DB_PORT:-5432}"
DB_URL="postgresql://postgres:${ENC_PW}@127.0.0.1:${DB_PORT}/postgres?sslmode=disable"
DB_CID="$(docker compose ps -q db)"
[[ -n "${DB_CID}" ]] || { echo "FEHLER: DB-Container fehlt." >&2; exit 1; }

run_supabase_cli() {
  docker run --rm --network "container:${DB_CID}" \
    -v "${mig_root}/supabase:/workspace/supabase" \
    -w /workspace \
    node:22-bookworm-slim \
    bash -lc "npx --yes supabase@2.105.0 $*"
}

psql_query() {
  docker compose exec -T db psql -U postgres -tAc "$1"
}

has_restaurants() {
  [[ "$(psql_query "SELECT to_regclass('public.restaurants') IS NOT NULL;")" == "t" ]]
}

if [[ "${GWADA_FORCE_DEV_DB_RESET:-0}" == "1" ]] || ! has_restaurants; then
  echo "→ Dev-DB Reset (nur Dev-VPS) …"
  run_supabase_cli db reset --db-url "${DB_URL}" --yes
fi

echo "→ supabase db push …"
run_supabase_cli db push --db-url "${DB_URL}" --yes --include-all

if ! has_restaurants; then
  echo "FEHLER: public.restaurants fehlt nach db push." >&2
  exit 1
fi

echo "→ PostgREST Schema neu laden …"
docker compose exec -T db psql -U postgres -c "NOTIFY pgrst, 'reload schema';" || true
docker compose restart rest
sleep 4

mig_count="$(psql_query "SELECT count(*) FROM supabase_migrations.schema_migrations;" 2>/dev/null || echo 0)"
echo "✓ Dev-DB-Migrationen angewendet (${mig_count} Migrationen, restaurants OK)."
