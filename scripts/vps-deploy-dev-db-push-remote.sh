#!/usr/bin/env bash
# Auf dem VPS: supabase db push gegen Dev-Postgres (Host-Port, kein ghcr-CLI-Image).
set -euo pipefail

compose_dir="$1"
mig_root="$2"
cli_version="${SUPABASE_CLI_VERSION:-2.105.0}"
cli_dir="/tmp/supabase-cli-${cli_version}"
supabase_bin="${cli_dir}/supabase"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

for i in $(seq 1 90); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose exec -T db pg_isready -U postgres

PW="$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//' | tr -d '\r\n')"
ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${PW}")"
DB_PORT="$(grep -m1 '^POSTGRES_PORT=' .env 2>/dev/null | sed 's/^POSTGRES_PORT=//' | tr -d '\r\n')"
DB_PORT="${DB_PORT:-5435}"
DB_URL="postgresql://postgres:${ENC_PW}@127.0.0.1:${DB_PORT}/postgres?sslmode=disable"

if [[ ! -x "${cli_dir}/supabase-go" ]]; then
  echo "→ Supabase CLI v${cli_version} herunterladen …"
  mkdir -p "${cli_dir}"
  curl -fsSL "https://github.com/supabase/cli/releases/download/v${cli_version}/supabase_${cli_version}_linux_amd64.tar.gz" \
    | tar -xzf - -C "${cli_dir}"
  chmod +x "${cli_dir}/supabase" "${cli_dir}/supabase-go" 2>/dev/null || true
fi
export PATH="${cli_dir}:${PATH}"

echo "→ supabase db push (CLI-Binary, localhost:${DB_PORT}) …"
cd "${mig_root}"
"${supabase_bin}" db push --db-url "${DB_URL}" --yes --include-all

cd "${compose_dir}"
echo "→ Dev-Stack hochfahren …"
mapfile -t DEV_SERVICES < <(docker compose config --services | grep -Ev '^(supavisor|pooler)$' || true)
docker compose up -d "${DEV_SERVICES[@]}"

echo "→ PostgREST + GoTrue neu laden …"
docker compose exec -T db psql -U postgres -c "NOTIFY pgrst, 'reload schema';" 2>/dev/null || true
docker compose up -d --force-recreate auth rest 2>/dev/null || docker compose restart auth rest
sleep 6

mig_count="$(docker compose exec -T db psql -U postgres -tAc "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
echo "✓ Dev-DB-Migrationen angewendet (${mig_count} Migrationen)."
