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

regenerate_dev_dotenv() {
  echo "→ Dev-.env neu generieren (frisches Volume, konsistente Secrets) …"
  local kong_port=8100 studio_port=54324
  if [[ -f .env ]]; then
    kong_port="$(grep -m1 '^KONG_HTTP_PORT=' .env | sed 's/^KONG_HTTP_PORT=//' | tr -d '\r\n')"
    studio_port="$(grep -m1 '^STUDIO_PORT=' .env | sed 's/^STUDIO_PORT=//' | tr -d '\r\n')"
  fi
  kong_port="${kong_port:-8100}"
  studio_port="${studio_port:-54324}"

  cp .env.example .env
  if [[ -x ./utils/generate-keys.sh ]]; then
    ./utils/generate-keys.sh .env
  fi
  local pg_pw
  pg_pw="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
  if grep -q '^POSTGRES_PASSWORD=' .env; then
    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pg_pw}|" .env
  else
    echo "POSTGRES_PASSWORD=${pg_pw}" >> .env
  fi

  upsert_env() {
    local key="$1" val="$2"
    if grep -q "^${key}=" .env; then
      sed -i "s|^${key}=.*|${key}=${val}|" .env
    else
      echo "${key}=${val}" >> .env
    fi
  }
  upsert_env "KONG_HTTP_PORT" "${kong_port}"
  upsert_env "KONG_HTTPS_PORT" "$((kong_port + 1))"
  upsert_env "STUDIO_PORT" "${studio_port}"
  upsert_env "SITE_URL" "http://localhost:3000"
  upsert_env "API_EXTERNAL_URL" "http://127.0.0.1:${kong_port}"
  upsert_env "SUPABASE_PUBLIC_URL" "http://127.0.0.1:${kong_port}"
  upsert_env "ADDITIONAL_REDIRECT_URLS" "http://localhost:3000/auth/callback,http://localhost:3000/api/auth/google/callback"
  upsert_env "GOTRUE_MAILER_AUTOCONFIRM" "true"
  upsert_env "ENABLE_EMAIL_SIGNUP" "true"
  # Postgres intern Standard :5432 — nicht 5435 (bricht Auth/REST im Compose-Netz)
  sed -i '/^POSTGRES_PORT=/d' .env
}

regenerate_dev_dotenv

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
