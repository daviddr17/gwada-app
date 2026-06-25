#!/usr/bin/env bash
# Auf dem VPS ausführen: lokale Seeds auf Dev-DB.
set -euo pipefail

compose_dir="$1"
network="$2"
seed_root="$3"

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

run_seed() {
  local rel="$1"
  local path="${seed_root}/${rel}"
  echo "→ ${rel}"
  docker run --rm --network "${network}" \
    -v "${path}:/seed.sql:ro" \
    postgres:17 \
    psql "${DB_URL}" -v ON_ERROR_STOP=1 -f /seed.sql
}

for f in \
  supabase/seed.sql \
  supabase/seed_menu_relational.sql \
  supabase/seed_inventory_relational.sql \
  supabase/seed_demo_user.sql \
  supabase/seed_dining_floor_demo.sql \
  supabase/seed_reservations_demo.sql
do
  run_seed "${f}"
done

user_count="$(docker run --rm --network "${network}" postgres:17 \
  psql "${DB_URL}" -tAc "SELECT count(*) FROM auth.users WHERE email = 'dreyer@techlion.de';")"
if [[ "${user_count}" != "1" ]]; then
  echo "FEHLER: Demo-User fehlt nach Seeds (count=${user_count})." >&2
  exit 1
fi

docker compose exec -T db psql -U postgres -c "NOTIFY pgrst, 'reload schema';" || true
docker compose restart rest auth
sleep 4

echo "✓ Dev-DB mit lokalen Seeds befüllt (gwada-demo, dreyer@techlion.de / GwadaLocal2026!)."
