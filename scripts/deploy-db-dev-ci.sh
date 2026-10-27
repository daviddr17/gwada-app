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

echo "→ Reset-/Provision-Skripte für ggf. korrupte Dev-DB …"
gwada_scp_cmd \
  "${ROOT}/scripts/vps-reset-dev-db-volume-remote.sh" \
  "${ROOT}/scripts/vps-provision-dev-supabase.sh" \
  "${ROOT}/scripts/vps-refresh-dev-env.sh" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}:/tmp/"

echo "→ Postgres auf VPS bereit halten …"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "DEV_COMPOSE_DIR=$(printf '%q' "${DEV_COMPOSE_DIR}") bash -s" <<'REMOTE'
set -euo pipefail
cd "${DEV_COMPOSE_DIR}"
export COMPOSE_PROJECT_NAME=gwada-dev
rm -f /tmp/gwada-dev-volume-was-reset

wait_db_ready() {
  local attempts="${1:-90}"
  local i
  for i in $(seq 1 "${attempts}"); do
    if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

dump_db_diag() {
  echo "--- gwada-dev-db diagnose ---" >&2
  docker compose ps db >&2 || true
  docker ps -a --filter name=gwada-dev-db --format '{{.Names}} {{.Status}}' >&2 || true
  docker compose logs --tail=80 db >&2 || true
  echo "--- end diagnose ---" >&2
}

db_has_corrupt_checkpoint() {
  docker compose logs --tail=120 db 2>/dev/null | grep -q 'could not locate a valid checkpoint record'
}

# Dev-only: WAL/checkpoint kaputt → Volume neu (kein Live).
# Agenten können seed-dev-db workflow_dispatch nicht (403); Push-Migrate muss selbst heilen.
reset_corrupt_dev_volume() {
  echo "Dev-Postgres: korrupter Checkpoint/WAL — Volume-Reset (Dev only) …" >&2
  dump_db_diag
  if [[ ! -f /tmp/vps-reset-dev-db-volume-remote.sh || ! -f /tmp/vps-provision-dev-supabase.sh ]]; then
    echo "FEHLER: Reset-Skripte fehlen unter /tmp (CI muss sie vorher scp'en)." >&2
    exit 1
  fi
  chmod +x /tmp/vps-reset-dev-db-volume-remote.sh /tmp/vps-provision-dev-supabase.sh
  if [[ -f /tmp/vps-refresh-dev-env.sh ]]; then
    chmod +x /tmp/vps-refresh-dev-env.sh
  fi
  bash /tmp/vps-reset-dev-db-volume-remote.sh "${DEV_COMPOSE_DIR}"
  cd "${DEV_COMPOSE_DIR}"
  export COMPOSE_PROJECT_NAME=gwada-dev
  if ! wait_db_ready 90; then
    dump_db_diag
    echo "FEHLER: Dev-Postgres nach Volume-Reset weiterhin nicht bereit." >&2
    exit 1
  fi
  echo "Dev-Postgres nach Volume-Reset bereit." >&2
  # Marker für CI: neues .env.development artifact hochladen
  touch /tmp/gwada-dev-volume-was-reset
}

docker compose up -d db
if ! wait_db_ready 90; then
  echo "Postgres nicht bereit — Container-Status prüfen und einmal neu starten …" >&2
  dump_db_diag
  if db_has_corrupt_checkpoint; then
    reset_corrupt_dev_volume
  else
    # Crash-loop / "is restarting": compose restart oft reicht; sonst recreate.
    docker compose restart db || true
    sleep 5
    if ! wait_db_ready 60; then
      echo "Restart reichte nicht — db recreate …" >&2
      docker compose up -d --force-recreate db
      sleep 8
      if ! wait_db_ready 90; then
        if db_has_corrupt_checkpoint; then
          reset_corrupt_dev_volume
        else
          dump_db_diag
          docker compose exec -T db pg_isready -U postgres
          exit 1
        fi
      fi
    fi
  fi
fi
docker compose exec -T db pg_isready -U postgres

mapfile -t NON_DB < <(docker compose config --services 2>/dev/null | grep -Ev '^(db|supavisor|pooler)$' || true)
if [[ ${#NON_DB[@]} -gt 0 ]]; then
  docker compose stop "${NON_DB[@]}" 2>/dev/null || true
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
gwada_scp_cmd \
  "${ROOT}/scripts/vps-deploy-dev-db-push-remote.sh" \
  "${ROOT}/scripts/vps-finish-dev-db-after-push-remote.sh" \
  "${ROOT}/scripts/vps-dev-db-repair-missing-files.sh" \
  "${DEV_SSH_USER}@${DEV_VPS_HOST}:/tmp/"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "chmod +x /tmp/vps-deploy-dev-db-push-remote.sh /tmp/vps-finish-dev-db-after-push-remote.sh /tmp/vps-dev-db-repair-missing-files.sh"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "bash /tmp/vps-deploy-dev-db-push-remote.sh ${DEV_COMPOSE_DIR} ${DEV_REMOTE_MIG_DIR} ${DEV_REMOTE_CLI_DIR}"
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "bash /tmp/vps-finish-dev-db-after-push-remote.sh ${DEV_COMPOSE_DIR}"
