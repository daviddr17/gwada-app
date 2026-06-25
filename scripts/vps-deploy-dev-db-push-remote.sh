#!/usr/bin/env bash
# Auf dem VPS: supabase db push im Docker-Netz (db-Hostname, kein SSH-Tunnel).
set -euo pipefail

compose_dir="$1"
mig_root="$2"
cli_dir="${3:-/tmp/supabase-cli}"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev
export PATH="${cli_dir}:${PATH}"

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
DB_IP="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$(docker compose ps -q db)")"
[[ -n "${DB_IP}" ]] || { echo "FEHLER: DB-Container-IP fehlt." >&2; exit 1; }

for db_port in 5432 5435; do
  if docker compose exec -T db psql -U postgres -h localhost -p "${db_port}" -tAc 'select 1' >/dev/null 2>&1; then
    echo "→ Postgres erreichbar auf ${DB_IP}:${db_port}"
    DB_URL="postgresql://postgres:${ENC_PW}@${DB_IP}:${db_port}/postgres?sslmode=disable"
    cd "${mig_root}"
    PGSSLMODE=disable "${cli_dir}/supabase" db push --db-url "${DB_URL}" --yes --include-all
    exit 0
  fi
done

echo "FEHLER: Postgres auf db:5432/5435 nicht erreichbar." >&2
exit 1
