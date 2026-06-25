#!/usr/bin/env bash
# Auf dem VPS: supabase db push im Docker-Netz (db:5432) — kein Runner-Tunnel.
set -euo pipefail

compose_dir="$1"
mig_root="$2"
cli_image="${SUPABASE_CLI_IMAGE:-ghcr.io/supabase/cli:v2.105.0}"

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
DB_URL="postgresql://postgres:${ENC_PW}@db:5432/postgres?sslmode=disable"

network="$(docker network ls --format '{{.Name}}' | grep '^gwada-dev' | head -1 || true)"
[[ -n "${network}" ]] || { echo "FEHLER: Docker-Netz gwada-dev_* fehlt." >&2; exit 1; }
echo "Docker-Netz: ${network}"

echo "→ supabase db push (CLI-Container) …"
docker run --rm \
  --network "${network}" \
  -v "${mig_root}/supabase:/work/supabase:ro" \
  -w /work \
  "${cli_image}" \
  db push --db-url "${DB_URL}" --yes --include-all

echo "→ Dev-Stack hochfahren …"
mapfile -t DEV_SERVICES < <(docker compose config --services | grep -Ev '^(supavisor|pooler)$' || true)
docker compose up -d "${DEV_SERVICES[@]}"

echo "→ PostgREST + GoTrue neu laden …"
docker compose exec -T db psql -U postgres -c "NOTIFY pgrst, 'reload schema';" 2>/dev/null || true
docker compose up -d --force-recreate auth rest 2>/dev/null || docker compose restart auth rest
sleep 6

mig_count="$(docker compose exec -T db psql -U postgres -tAc "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
echo "✓ Dev-DB-Migrationen angewendet (${mig_count} Migrationen)."
