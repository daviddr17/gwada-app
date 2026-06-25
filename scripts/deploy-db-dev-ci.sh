#!/usr/bin/env bash
# CI: Migrationen auf Dev-DB — supabase db push auf dem VPS (CLI vom Runner).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_COMPOSE_DIR="${DEV_COMPOSE_DIR:-/opt/gwada-supabase-dev}"
export DEV_REMOTE_MIG_DIR="${DEV_REMOTE_MIG_DIR:-/tmp/gwada-dev-migrations}"
export DEV_REMOTE_CLI_DIR="${DEV_REMOTE_CLI_DIR:-/tmp/supabase-cli}"

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

SUPABASE_BIN="$(command -v supabase)"
[[ -x "${SUPABASE_BIN}" ]] || { echo "FEHLER: supabase CLI fehlt auf dem Runner." >&2; exit 1; }
SUPABASE_DIR="$(dirname "${SUPABASE_BIN}")"
SUPABASE_GO="${SUPABASE_DIR}/supabase-go"
[[ -x "${SUPABASE_GO}" ]] || SUPABASE_GO="$(find "${SUPABASE_DIR}" -maxdepth 1 -name 'supabase-go' -type f -perm -111 2>/dev/null | head -1)"
[[ -x "${SUPABASE_GO}" ]] || { echo "FEHLER: supabase-go neben Runner-CLI nicht gefunden." >&2; exit 1; }

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

echo "Übertrage Migrationen …"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "rm -rf ${DEV_REMOTE_MIG_DIR} ${DEV_REMOTE_CLI_DIR} && mkdir -p ${DEV_REMOTE_MIG_DIR} ${DEV_REMOTE_CLI_DIR}"
tar -C "${ROOT}" -czf - supabase/migrations supabase/config.toml \
  | gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "tar -xzf - -C ${DEV_REMOTE_MIG_DIR}"

echo "Übertrage Supabase CLI (linux amd64 vom Runner) …"
gwada_scp_cmd "${SUPABASE_BIN}" "${SUPABASE_GO}" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}:${DEV_REMOTE_CLI_DIR}/"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" "chmod +x ${DEV_REMOTE_CLI_DIR}/supabase ${DEV_REMOTE_CLI_DIR}/supabase-go"

echo ""
echo "=== Dev-DB: Migrationen anwenden (supabase db push auf VPS) ==="
gwada_scp_cmd "${ROOT}/scripts/vps-deploy-dev-db-push-remote.sh" \
  "${ROOT}/scripts/vps-finish-dev-db-after-push-remote.sh" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}:/tmp/"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "bash /tmp/vps-deploy-dev-db-push-remote.sh ${DEV_COMPOSE_DIR} ${DEV_REMOTE_MIG_DIR} ${DEV_REMOTE_CLI_DIR}"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "bash /tmp/vps-finish-dev-db-after-push-remote.sh ${DEV_COMPOSE_DIR}"
