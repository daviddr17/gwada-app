#!/usr/bin/env bash
# Spiegelt lokale Supabase-Seeds (config.toml [db.seed]) auf die Dev-DB auf dem VPS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_COMPOSE_DIR="${DEV_COMPOSE_DIR:-/opt/gwada-supabase-dev}"
export DEV_DOCKER_NETWORK="${DEV_DOCKER_NETWORK:-gwada-dev_default}"
export DEV_REMOTE_DIR="${DEV_REMOTE_DIR:-/tmp/gwada-dev-seeds}"

: "${GWADA_SSH_IDENTITY:=${HOME}/.ssh/id_ed25519}"
GWADA_SSH_OPTS=(-o ConnectTimeout=15 -o BatchMode=yes -o StrictHostKeyChecking=accept-new)
if [[ -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH_OPTS+=(-i "${GWADA_SSH_IDENTITY}")
fi

gwada_ssh_cmd() {
  ssh "${GWADA_SSH_OPTS[@]}" "$@"
}

SEED_FILES=(
  supabase/seed.sql
  supabase/seed_menu_relational.sql
  supabase/seed_inventory_relational.sql
  supabase/seed_demo_user.sql
  supabase/seed_dining_floor_demo.sql
  supabase/seed_reservations_demo.sql
)

if ! gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zum VPS fehlgeschlagen." >&2
  exit 1
fi

echo "Übertrage Seed-Dateien …"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "rm -rf ${DEV_REMOTE_DIR} && mkdir -p ${DEV_REMOTE_DIR}"
tar -C "${ROOT}" -czf - "${SEED_FILES[@]}" \
  | gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "tar -xzf - -C ${DEV_REMOTE_DIR}"

echo ""
echo "=== Dev-DB: lokale Seeds anwenden ==="
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" bash -s -- \
  "${DEV_COMPOSE_DIR}" "${DEV_DOCKER_NETWORK}" "${DEV_REMOTE_DIR}" <<'REMOTE' | tee /dev/stderr
set -euo pipefail
compose_dir="$1"
network="$2"
seed_root="$3"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

if ! docker network inspect "${network}" >/dev/null 2>&1; then
  network="$(docker network ls --format '{{.Name}}' | grep '^gwada-dev' | head -1 || true)"
fi
[[ -n "${network}" ]] || { echo "FEHLER: Docker-Netz gwada-dev_* fehlt." >&2; exit 1; }

PW="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r')"
ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${PW}")"
DB_URL="postgresql://postgres:${ENC_PW}@gwada-dev-db:5432/postgres?sslmode=disable"

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

echo ""
echo "✓ Dev-DB mit lokalen Seeds befüllt (gwada-demo, dreyer@techlion.de / GwadaLocal2026!)."
REMOTE
