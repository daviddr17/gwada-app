#!/usr/bin/env bash
# CI: Migrationen auf Dev-DB — supabase db push vom Runner via SSH-Tunnel.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_COMPOSE_DIR="${DEV_COMPOSE_DIR:-/opt/gwada-supabase-dev}"
export DEV_TUNNEL_LOCAL_PORT="${DEV_TUNNEL_LOCAL_PORT:-15432}"

: "${GWADA_SSH_IDENTITY:=${HOME}/.ssh/id_ed25519}"
GWADA_SSH_OPTS=(-o ConnectTimeout=15 -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ServerAliveCountMax=120)
if [[ -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH_OPTS+=(-i "${GWADA_SSH_IDENTITY}")
fi

gwada_ssh_cmd() {
  ssh "${GWADA_SSH_OPTS[@]}" -o LogLevel=ERROR "$@"
}
gwada_scp_cmd() {
  scp "${GWADA_SSH_OPTS[@]}" "$@"
}

if ! gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zum VPS fehlgeschlagen." >&2
  exit 1
fi

read_vps_env() {
  gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
    "grep -m1 '^${1}=' '${DEV_COMPOSE_DIR}/.env' | sed 's/^${1}=//' | tr -d '\r\n'"
}

echo "→ Postgres auf VPS bereit halten …"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" bash <<REMOTE
set -euo pipefail
cd "${DEV_COMPOSE_DIR}"
export COMPOSE_PROJECT_NAME=gwada-dev
docker compose up -d db
for i in \$(seq 1 60); do
  docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 2
done
docker compose exec -T db pg_isready -U postgres
mapfile -t NON_DB < <(docker compose config --services 2>/dev/null | grep -Ev '^(db|supavisor|pooler)$' || true)
if [[ \${#NON_DB[@]} -gt 0 ]]; then
  docker compose stop "\${NON_DB[@]}" 2>/dev/null || true
fi
REMOTE

POSTGRES_PASSWORD="$(gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "cd '${DEV_COMPOSE_DIR}' && COMPOSE_PROJECT_NAME=gwada-dev docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r'")"
[[ -n "${POSTGRES_PASSWORD}" ]] || POSTGRES_PASSWORD="$(read_vps_env POSTGRES_PASSWORD)"
POSTGRES_PORT="$(read_vps_env POSTGRES_PORT)"
POSTGRES_PORT="${POSTGRES_PORT:-5435}"
# Im Docker-Netz lauscht Postgres typisch auf 5432 (POSTGRES_PORT betrifft Host-Mapping).
DB_TUNNEL_PORT="5432"
DB_CONTAINER_IP="$(gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' gwada-dev-db")"
[[ -n "${DB_CONTAINER_IP}" ]] || { echo "FEHLER: gwada-dev-db Container-IP fehlt." >&2; exit 1; }
ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${POSTGRES_PASSWORD}")"

echo ""
echo "=== Dev-DB: Migrationen anwenden (supabase db push via SSH-Tunnel) ==="
echo "Tunnel → ${DB_CONTAINER_IP}:${DB_TUNNEL_PORT} (Docker-Netz auf VPS)"
gwada_ssh_cmd -N -L "${DEV_TUNNEL_LOCAL_PORT}:${DB_CONTAINER_IP}:${DB_TUNNEL_PORT}" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}" &
TUNNEL_PID=$!
cleanup() {
  kill "${TUNNEL_PID}" 2>/dev/null || true
}
trap cleanup EXIT

for i in $(seq 1 60); do
  if (echo >/dev/tcp/127.0.0.1/"${DEV_TUNNEL_LOCAL_PORT}") >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

DB_URL="postgresql://postgres:${ENC_PW}@127.0.0.1:${DEV_TUNNEL_LOCAL_PORT}/postgres?sslmode=disable"
if ! command -v supabase >/dev/null 2>&1; then
  echo "FEHLER: supabase CLI fehlt auf dem Runner (setup-cli)." >&2
  exit 1
fi
PGSSLMODE=disable PGCONNECT_TIMEOUT=15 \
  supabase db push --db-url "${DB_URL}" --yes --include-all

gwada_scp_cmd "${ROOT}/scripts/vps-finish-dev-db-after-push-remote.sh" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}:/tmp/vps-finish-dev-db-after-push-remote.sh"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "bash /tmp/vps-finish-dev-db-after-push-remote.sh ${DEV_COMPOSE_DIR}"
