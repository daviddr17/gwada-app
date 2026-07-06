#!/usr/bin/env bash
# Live: Bubble-Arbeitszeiten (ein Tag) → restaurant_staff_work_entries (zurschlagd).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DATE_YMD=""
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    20??-??-??) DATE_YMD="$arg" ;;
  esac
done

if [[ -z "${DATE_YMD}" ]]; then
  echo "Usage: bash scripts/import-bubble-staff-times-live.sh YYYY-MM-DD [--dry-run]" >&2
  exit 1
fi

# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

COOLIFY_APP_ID="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
COMPOSE_ENV="/data/coolify/applications/${COOLIFY_APP_ID}/.env"
VPS="${LIVE_VPS_HOST:-}"

read_vps_env_key() {
  local key="$1"
  gwada_ssh_cmd "root@${VPS}" \
    "grep -E '^${key}=' '${COMPOSE_ENV}' 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"'" \
    || true
}

if [[ -z "${VPS}" ]]; then
  echo "LIVE_VPS_HOST fehlt." >&2
  exit 1
fi

if ! gwada_ssh_cmd -o ConnectTimeout=8 "root@${VPS}" true 2>/dev/null; then
  echo "SSH zum Live-VPS fehlgeschlagen (${VPS})." >&2
  exit 1
fi

export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-$(read_vps_env_key NEXT_PUBLIC_SUPABASE_URL)}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$(read_vps_env_key SUPABASE_SERVICE_ROLE_KEY)}"
export BUBBLE_API_TOKEN="${BUBBLE_API_TOKEN:-$(read_vps_env_key BUBBLE_API_TOKEN)}"
export GWADA_LEGACY_BUBBLE_URL="${GWADA_LEGACY_BUBBLE_URL:-$(read_vps_env_key GWADA_LEGACY_BUBBLE_URL)}"

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL}" || -z "${SUPABASE_SERVICE_ROLE_KEY}" ]]; then
  echo "NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt (VPS ${COMPOSE_ENV})." >&2
  exit 1
fi
if [[ -z "${BUBBLE_API_TOKEN}" ]]; then
  echo "BUBBLE_API_TOKEN fehlt (GitHub Secret oder VPS ${COMPOSE_ENV})." >&2
  exit 1
fi

args=("${DATE_YMD}")
if [[ "${DRY_RUN}" == "1" ]]; then
  args+=(--dry-run)
fi

node "${ROOT}/scripts/migrate-bubble-staff-times-day.mjs" "${args[@]}"
