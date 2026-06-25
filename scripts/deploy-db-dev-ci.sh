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
  ssh "${GWADA_SSH_OPTS[@]}" "$@"
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
  "${DEV_COMPOSE_DIR}" "${DEV_DOCKER_NETWORK}" "${DEV_REMOTE_MIG_DIR}" "$*" <<'REMOTE'
set -euo pipefail
compose_dir="$1"
network="$2"
mig_root="$3"
shift 3
extra_args=("$@")

cd "${compose_dir}"
PW="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r')"
ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${PW}")"
DB_URL="postgresql://postgres:${ENC_PW}@gwada-dev-db:5432/postgres?sslmode=disable"

docker run --rm --network "${network}" \
  -v "${mig_root}/supabase:/workspace/supabase" \
  -w /workspace \
  ghcr.io/supabase/cli:2.105.0 \
  db push --db-url "${DB_URL}" --yes --include-all "${extra_args[@]}"

echo ""
echo "Dev-DB-Migrationen angewendet."
REMOTE
