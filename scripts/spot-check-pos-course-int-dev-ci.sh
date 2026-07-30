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

remote_psql() {
  local sql="$1"
  gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
    "cd ${DEV_COMPOSE_DIR} && COMPOSE_PROJECT_NAME=gwada-dev docker compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 -P pager=off -c $(printf '%q' "${sql}")"
}

echo ""
echo "=== Dev-DB spot-check: pos course int migration ==="
gwada_ssh_cmd "${DEV_SSH_USER}@${DEV_VPS_HOST}" \
  "cd ${DEV_COMPOSE_DIR} && COMPOSE_PROJECT_NAME=gwada-dev docker compose exec -T db pg_isready -U postgres"

echo ""
echo "--- pg_typeof(course) ---"
remote_psql "select pg_typeof(course)::text as course_type from public.pos_order_lines limit 1;"

echo ""
echo "--- pos_order_lines.course (limit 5) ---"
remote_psql "select course from public.pos_order_lines limit 5;"

echo ""
echo "--- pos_kds_devices.courses (limit 5) ---"
remote_psql "select courses from public.pos_kds_devices limit 5;"

echo ""
echo "--- pos_order_course enum remaining ---"
remote_psql "select count(*)::int as enum_left from pg_type where typname = 'pos_order_course';"

echo ""
echo "--- information_schema column types (empty-table fallback) ---"
remote_psql "select table_name, column_name, data_type, udt_name from information_schema.columns where table_schema = 'public' and ((table_name = 'pos_order_lines' and column_name = 'course') or (table_name = 'pos_kds_devices' and column_name = 'courses')) order by table_name;"
