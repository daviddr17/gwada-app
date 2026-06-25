#!/usr/bin/env bash
# CI: Migrationen auf Dev-DB — läuft auf dem VPS im Docker-Netz (kein Runner-Tunnel).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_COMPOSE_DIR="${DEV_COMPOSE_DIR:-/opt/gwada-supabase-dev}"
export DEV_DOCKER_NETWORK="${DEV_DOCKER_NETWORK:-gwada-dev_default}"
export DEV_REMOTE_MIG_DIR="${DEV_REMOTE_MIG_DIR:-/tmp/gwada-dev-migrations}"

: "${GWADA_SSH_IDENTITY:=${HOME}/.ssh/id_ed25519}"
GWADA_SSH_OPTS=(-o ConnectTimeout=15 -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
if [[ -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH_OPTS+=(-i "${GWADA_SSH_IDENTITY}")
fi

gwada_ssh_cmd() {
  ssh "${GWADA_SSH_OPTS[@]}" -o LogLevel=ERROR "$@"
}

if ! gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zum VPS fehlgeschlagen." >&2
  exit 1
fi

echo "Übertrage Migrationen …"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "rm -rf ${DEV_REMOTE_MIG_DIR} && mkdir -p ${DEV_REMOTE_MIG_DIR}"
tar -C "${ROOT}" -czf - supabase/migrations supabase/config.toml \
  | gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "tar -xzf - -C ${DEV_REMOTE_MIG_DIR}"

echo ""
echo "=== Dev-DB: Migrationen anwenden (nur Schema) ==="
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" bash -s -- \
  "${DEV_COMPOSE_DIR}" "${DEV_DOCKER_NETWORK}" "${DEV_REMOTE_MIG_DIR}" "$*" <<'REMOTE' | tee /dev/stderr
set -euo pipefail
compose_dir="$1"
network="$2"
mig_root="$3"
shift 3
extra_args=("$@")

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

if ! docker network inspect "${network}" >/dev/null 2>&1; then
  network="$(docker network ls --format '{{.Name}}' | grep '^gwada-dev' | head -1 || true)"
fi
[[ -n "${network}" ]] || { echo "FEHLER: Docker-Netz gwada-dev_* fehlt." >&2; exit 1; }
echo "Docker-Netz: ${network}"

PW="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r')"
ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${PW}")"
DB_URL="postgresql://postgres:${ENC_PW}@gwada-dev-db:5432/postgres?sslmode=disable"

psql_query() {
  docker run --rm --network "${network}" postgres:17 \
    psql "${DB_URL}" -v ON_ERROR_STOP=1 -tAc "$1"
}

has_restaurants() {
  [[ "$(psql_query "SELECT to_regclass('public.restaurants') IS NOT NULL;")" == "t" ]]
}

echo "→ supabase db push …"
docker run --rm --network "${network}" \
  -v "${mig_root}/supabase:/workspace/supabase" \
  -w /workspace \
  ghcr.io/supabase/cli:2.105.0 \
  db push --db-url "${DB_URL}" --yes --include-all "${extra_args[@]}"

if ! has_restaurants; then
  echo "WARN: public.restaurants fehlt — Migration-Historie zurücksetzen und erneut pushen …"
  psql_query "TRUNCATE supabase_migrations.schema_migrations;" || true
  docker run --rm --network "${network}" \
    -v "${mig_root}/supabase:/workspace/supabase" \
    -w /workspace \
    ghcr.io/supabase/cli:2.105.0 \
    db push --db-url "${DB_URL}" --yes --include-all "${extra_args[@]}"
fi

if ! has_restaurants; then
  echo "FEHLER: public.restaurants fehlt nach db push." >&2
  exit 1
fi

echo "→ PostgREST Schema neu laden …"
docker compose exec -T db psql -U postgres -c "NOTIFY pgrst, 'reload schema';" || true
docker compose restart rest
sleep 4

mig_count="$(psql_query "SELECT count(*) FROM supabase_migrations.schema_migrations;")"
echo "✓ Dev-DB-Migrationen angewendet (${mig_count} Migrationen, restaurants OK)."
REMOTE
