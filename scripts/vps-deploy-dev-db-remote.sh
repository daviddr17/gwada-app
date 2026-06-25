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

if ! docker network inspect "${network}" >/dev/null 2>&1; then
  network="$(docker network ls --format '{{.Name}}' | grep '^gwada-dev' | head -1 || true)"
fi
[[ -n "${network}" ]] || { echo "FEHLER: Docker-Netz gwada-dev_* fehlt." >&2; exit 1; }
echo "Docker-Netz: ${network}"

PW="$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//' | tr -d '\r\n')"
ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${PW}")"
DB_PORT="$(grep -m1 '^POSTGRES_PORT=' .env | sed 's/^POSTGRES_PORT=//' | tr -d '\r\n')"
DB_PORT="${DB_PORT:-5432}"
DB_URL="postgresql://postgres:${ENC_PW}@gwada-dev-db:${DB_PORT}/postgres?sslmode=disable"

psql_query() {
  docker run --rm --network "${network}" postgres:17 \
    psql "${DB_URL}" -v ON_ERROR_STOP=1 -tAc "$1"
}

has_restaurants() {
  [[ "$(psql_query "SELECT to_regclass('public.restaurants') IS NOT NULL;")" == "t" ]]
}

echo "→ supabase db push …"
docker run --rm --network "${network}" \
  -v "${mig_root}/supabase:/workspace/supabase" \
  -w /workspace \
  node:22-bookworm-slim \
  bash -lc "npx --yes supabase@2.105.0 db push --db-url \"${DB_URL}\" --yes --include-all"

if ! has_restaurants; then
  echo "WARN: public.restaurants fehlt — Migration-Historie zurücksetzen und erneut pushen …"
  psql_query "TRUNCATE supabase_migrations.schema_migrations;" || true
  docker run --rm --network "${network}" \
    -v "${mig_root}/supabase:/workspace/supabase" \
    -w /workspace \
    node:22-bookworm-slim \
    bash -lc "npx --yes supabase@2.105.0 db push --db-url \"${DB_URL}\" --yes --include-all"
fi

if ! has_restaurants; then
  echo "FEHLER: public.restaurants fehlt nach db push." >&2
  exit 1
fi

echo "→ PostgREST Schema neu laden …"
docker compose exec -T db psql -U postgres -c "NOTIFY pgrst, 'reload schema';" || true
docker compose restart rest
sleep 4

mig_count="$(psql_query "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
echo "✓ Dev-DB-Migrationen angewendet (${mig_count} Migrationen, restaurants OK)."
