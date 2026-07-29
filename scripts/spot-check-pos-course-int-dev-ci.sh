#!/usr/bin/env bash
# CI: Spot-check pos course int migration on Dev-DB (read-only SQL via VPS SSH).
set -euo pipefail

export DEV_VPS_HOST="${DEV_VPS_HOST:-${LIVE_VPS_HOST:-95.111.229.250}}"
export DEV_SSH_USER="${DEV_SSH_USER:-root}"
export DEV_COMPOSE_DIR="${DEV_COMPOSE_DIR:-/opt/gwada-supabase-dev}"

: "${GWADA_SSH_IDENTITY:=${HOME}/.ssh/id_ed25519}"
GWADA_SSH_OPTS=(-o ConnectTimeout=15 -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ServerAliveCountMax=120)
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

echo ""
echo "=== Dev-DB spot-check: pos course int migration ==="
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" bash <<REMOTE
set -euo pipefail
cd "${DEV_COMPOSE_DIR}"
export COMPOSE_PROJECT_NAME=gwada-dev
docker compose exec -T db pg_isready -U postgres
docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 <<'SQL'
\\echo '--- pg_typeof(course) ---'
select pg_typeof(course)::text as course_type from public.pos_order_lines limit 1;
\\echo '--- pos_order_lines.course (limit 5) ---'
select course from public.pos_order_lines limit 5;
\\echo '--- pos_kds_devices.courses (limit 5) ---'
select courses from public.pos_kds_devices limit 5;
\\echo '--- pos_order_course enum remaining ---'
select count(*)::int as enum_left from pg_type where typname = 'pos_order_course';
SQL
REMOTE
