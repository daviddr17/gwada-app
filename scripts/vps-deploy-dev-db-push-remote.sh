#!/usr/bin/env bash
# Auf dem VPS: supabase db push im Docker-Netz (CLI vom Runner, kein Host-TCP-Auth).
set -euo pipefail

compose_dir="$1"
mig_root="$2"
cli_dir="${3:-/tmp/supabase-cli}"

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
network="$(docker network ls --format '{{.Name}}' | grep '^gwada-dev' | head -1 || true)"
[[ -n "${network}" ]] || { echo "FEHLER: Docker-Netz gwada-dev_* fehlt." >&2; exit 1; }

for db_port in 5432 5435; do
  if docker run --rm --network "${network}" \
    -e PGPASSWORD="${PW}" \
    postgres:17-alpine \
    psql "postgresql://supabase_admin@db:${db_port}/postgres?sslmode=disable" -tAc 'select 1' >/dev/null 2>&1; then
    echo "→ Postgres erreichbar im Netz ${network} (db:${db_port})"
    docker run --rm \
      --network "${network}" \
      -v "${mig_root}:/work" \
      -v "${cli_dir}:/cli:ro" \
      -w /work \
      -e PATH="/cli:${PATH}" \
      -e PGSSLMODE=disable \
      ubuntu:22.04 \
      /cli/supabase db push \
        --db-url "postgresql://supabase_admin:${ENC_PW}@db:${db_port}/postgres?sslmode=disable" \
        --yes --include-all
    exit 0
  fi
done

echo "FEHLER: Postgres im Docker-Netz nicht erreichbar (supabase_admin@db:5432/5435)." >&2
exit 1
