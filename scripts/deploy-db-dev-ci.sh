#!/usr/bin/env bash
# CI: SSH-Tunnel + supabase db push gegen Dev-DB (gleicher Weg wie Live, kein psql Multi-Pass).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_COMPOSE_DIR="${DEV_COMPOSE_DIR:-/opt/gwada-supabase-dev}"
export DEV_TUNNEL_LOCAL_PORT="${DEV_TUNNEL_LOCAL_PORT:-5436}"
# Host-Port des Dev-Postgres (Compose mappt 5435→5432, stabiler als Container-IP nach Reset)
export DEV_TUNNEL_REMOTE_PORT="${DEV_TUNNEL_REMOTE_PORT:-5435}"

: "${GWADA_SSH_IDENTITY:=${HOME}/.ssh/id_ed25519}"
GWADA_SSH_OPTS=(
  -o ControlMaster=auto
  -o "ControlPath=${TMPDIR:-/tmp}/gwada-ssh-dev-ci-${DEV_SSH_USER}-${DEV_VPS_HOST}.sock"
  -o ControlPersist=600
  -o StrictHostKeyChecking=accept-new
  -o BatchMode=yes
)
if [[ -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH_OPTS+=(-i "${GWADA_SSH_IDENTITY}")
fi

gwada_dev_ssh() {
  ssh "${GWADA_SSH_OPTS[@]}" "$@"
}

dev_tunnel_stop() {
  gwada_dev_ssh -O exit "${DEV_SSH_USER}@${DEV_VPS_HOST}" 2>/dev/null || true
}

cleanup() {
  dev_tunnel_stop
}
trap cleanup EXIT INT TERM

if ! command -v supabase >/dev/null 2>&1 && ! npx supabase --version >/dev/null 2>&1; then
  echo "Supabase CLI fehlt." >&2
  exit 1
fi

if ! gwada_dev_ssh -o ConnectTimeout=8 "${DEV_SSH_USER}@${DEV_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zum VPS fehlgeschlagen." >&2
  exit 1
fi

echo "Warte auf Dev-Postgres (VPS :${DEV_TUNNEL_REMOTE_PORT}) …"
gwada_dev_ssh "${DEV_SSH_USER}@${DEV_VPS_HOST}" bash <<REMOTE
set -euo pipefail
cd "${DEV_COMPOSE_DIR}"
export COMPOSE_PROJECT_NAME=gwada-dev
for i in \$(seq 1 90); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose exec -T db pg_isready -U postgres
REMOTE

if nc -z 127.0.0.1 "${DEV_TUNNEL_LOCAL_PORT}" 2>/dev/null; then
  echo "Tunnel-Port 127.0.0.1:${DEV_TUNNEL_LOCAL_PORT} bereits offen."
else
  echo "Starte Tunnel → VPS 127.0.0.1:${DEV_TUNNEL_REMOTE_PORT} …"
  gwada_dev_ssh -f -N \
    -L "${DEV_TUNNEL_LOCAL_PORT}:127.0.0.1:${DEV_TUNNEL_REMOTE_PORT}" \
    "${DEV_SSH_USER}@${DEV_VPS_HOST}"
  for i in $(seq 1 20); do
    if nc -z 127.0.0.1 "${DEV_TUNNEL_LOCAL_PORT}" 2>/dev/null; then
      break
    fi
    sleep 1
  done
fi

if ! nc -z 127.0.0.1 "${DEV_TUNNEL_LOCAL_PORT}" 2>/dev/null; then
  echo "Dev-Tunnel-Port ${DEV_TUNNEL_LOCAL_PORT} nicht erreichbar." >&2
  exit 1
fi

DB_CONTAINER="$(
  gwada_dev_ssh "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
    "docker ps --format '{{.Names}}' | grep 'gwada-dev-db' | head -1"
)"
DB_CONTAINER="${DB_CONTAINER//$'\r'/}"
if [[ -z "${DB_CONTAINER}" ]]; then
  echo "Dev-DB-Container (gwada-dev-db) nicht gefunden." >&2
  exit 1
fi

POSTGRES_PASSWORD="$(
  gwada_dev_ssh "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
    "docker exec ${DB_CONTAINER} printenv POSTGRES_PASSWORD"
)"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD//$'\r'/}"
if [[ -z "${POSTGRES_PASSWORD}" ]]; then
  echo "POSTGRES_PASSWORD im Dev-Container leer." >&2
  exit 1
fi

ENC_PW="$(
  python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${POSTGRES_PASSWORD}"
)"

export SUPABASE_DB_URL="postgresql://postgres:${ENC_PW}@127.0.0.1:${DEV_TUNNEL_LOCAL_PORT}/postgres?sslmode=disable"
export PGSSLMODE=disable

echo ""
echo "=== Dev-DB: Migrationen anwenden (supabase db push) ==="
bash scripts/db-push-live.sh --yes --include-all "$@"

echo ""
echo "→ Dev-Stack hochfahren + Auth/REST neu laden …"
gwada_dev_ssh "${DEV_SSH_USER}@${DEV_VPS_HOST}" bash <<REMOTE
set -euo pipefail
cd "${DEV_COMPOSE_DIR}"
export COMPOSE_PROJECT_NAME=gwada-dev
mapfile -t DEV_SERVICES < <(docker compose config --services | grep -Ev '^(supavisor|pooler)$' || true)
docker compose up -d "\${DEV_SERVICES[@]}"
docker compose exec -T db psql -U postgres -c "NOTIFY pgrst, 'reload schema';" 2>/dev/null || true
docker compose up -d --force-recreate auth rest 2>/dev/null || docker compose restart auth rest
REMOTE

echo ""
echo "Dev-DB-Migrationen angewendet."
