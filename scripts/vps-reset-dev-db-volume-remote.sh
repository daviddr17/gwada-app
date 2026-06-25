#!/usr/bin/env bash
# Dev-Postgres komplett zurücksetzen (wegwerfbar — nur Dev-Stack auf dem VPS).
set -euo pipefail

compose_dir="${1:-/opt/gwada-supabase-dev}"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

free_host_port() {
  local port="$1"
  local line cid
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    cid="${line%% *}"
    echo "→ Stoppe ${line#* } (Host :${port})"
    docker rm -f "${cid}" 2>/dev/null || true
  done < <(docker ps -a --format '{{.ID}} {{.Names}} {{.Ports}}' | grep -E ":${port}->" || true)

  if command -v fuser >/dev/null 2>&1 && ss -tln 2>/dev/null | grep -q ":${port} "; then
    echo "→ fuser :${port} …"
    fuser -k "${port}/tcp" 2>/dev/null || true
    sleep 1
  fi
}

echo "→ Dev-Stack vollständig stoppen …"
if [[ -f docker-compose.yml ]]; then
  docker compose stop -t 10 2>/dev/null || true
  docker compose rm -f 2>/dev/null || true
  docker compose down -v --remove-orphans 2>/dev/null || true
fi

if ids="$(docker ps -aq --filter name=gwada-dev-)"; [[ -n "${ids}" ]]; then
  echo "→ Entferne gwada-dev-* Container …"
  docker rm -f ${ids}
fi

free_host_port 8100
free_host_port 8101

rm -f "${compose_dir}/.secrets-rotated-after-leak"

echo "→ Dev-.env bereinigen (POSTGRES_PORT-Override entfernen) …"
if [[ -f .env ]]; then
  sed -i '/^POSTGRES_PORT=/d' .env
else
  echo "FEHLER: ${compose_dir}/.env fehlt — zuerst provision-dev-supabase ausführen." >&2
  exit 1
fi

if ss -tln 2>/dev/null | grep -q ':8100 '; then
  echo "FEHLER: Host-Port 8100 noch belegt (kein Docker-Container?):" >&2
  ss -tlnp 2>/dev/null | grep ':8100 ' || true
  exit 1
fi

echo "→ Dev-Stack neu starten …"
if ! docker compose up -d; then
  echo "WARN: compose up fehlgeschlagen — DB-Logs:" >&2
  docker compose logs db --tail 30 2>&1 || true
  exit 1
fi

for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose exec -T db pg_isready -U postgres

KONG_PORT="$(grep -m1 '^KONG_HTTP_PORT=' .env 2>/dev/null | sed 's/^KONG_HTTP_PORT=//' | tr -d '\r\n')"
KONG_PORT="${KONG_PORT:-8100}"

for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${KONG_PORT}/auth/v1/health" >/dev/null 2>&1; then
    echo "✓ Dev-Postgres-Volume zurückgesetzt (Kong :${KONG_PORT}, Auth OK)."
    exit 0
  fi
  sleep 2
done

if docker compose ps kong 2>/dev/null | grep -q "(healthy)"; then
  echo "WARN: Auth noch nicht bereit — Kong :${KONG_PORT} läuft, weiter mit Migrationen." >&2
  docker compose logs auth --tail 20 2>&1 || true
  exit 0
fi

echo "FEHLER: Kong/Auth auf :${KONG_PORT} nicht erreichbar." >&2
docker compose ps >&2
exit 1
