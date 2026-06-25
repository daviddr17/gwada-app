#!/usr/bin/env bash
# Dev-Postgres komplett zurücksetzen (wegwerfbar — nur Dev-Stack auf dem VPS).
set -euo pipefail

compose_dir="${1:-/opt/gwada-supabase-dev}"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

free_host_port() {
  local port="$1"
  local cid name
  for cid in $(docker ps -q); do
    if docker port "${cid}" 2>/dev/null | grep -qE ":${port}(/| ->)"; then
      name="$(docker inspect --format '{{.Name}}' "${cid}" | sed 's#^/##')"
      echo "→ Stoppe ${name} (Host :${port})"
      docker rm -f "${cid}"
    fi
  done
}

echo "→ Dev-Stack vollständig stoppen …"
if [[ -f docker-compose.yml ]]; then
  docker compose stop -t 10 2>/dev/null || true
  docker compose rm -f 2>/dev/null || true
  docker compose down -v --remove-orphans 2>/dev/null || true
fi

if ids="$(docker ps -aq --filter name=gwada-dev-)"; then
  echo "→ Entferne gwada-dev-* Container …"
  docker rm -f ${ids}
fi

free_host_port 8100
free_host_port 8101

rm -f "${compose_dir}/.secrets-rotated-after-leak"

if ss -tln 2>/dev/null | grep -q ':8100 '; then
  echo "FEHLER: Host-Port 8100 noch belegt (kein Docker-Container?):" >&2
  ss -tlnp 2>/dev/null | grep ':8100 ' || true
  exit 1
fi

echo "→ Dev-Stack neu starten …"
docker compose up -d

for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose exec -T db pg_isready -U postgres

echo "→ Auth/REST mit frischer .env …"
docker compose up -d --force-recreate auth rest

KONG_PORT="$(grep -m1 '^KONG_HTTP_PORT=' .env 2>/dev/null | sed 's/^KONG_HTTP_PORT=//' | tr -d '\r\n')"
KONG_PORT="${KONG_PORT:-8100}"

for i in $(seq 1 45); do
  if curl -sf "http://127.0.0.1:${KONG_PORT}/auth/v1/health" >/dev/null 2>&1; then
    echo "✓ Dev-Postgres-Volume zurückgesetzt (Kong :${KONG_PORT})."
    exit 0
  fi
  sleep 2
done

echo "FEHLER: Kong/Auth auf :${KONG_PORT} nicht erreichbar." >&2
docker compose ps >&2
exit 1
