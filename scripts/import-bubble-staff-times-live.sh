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

: "${LIVE_VPS_HOST:?LIVE_VPS_HOST fehlt}"
: "${GWADA_SSH_IDENTITY:=${HOME}/.ssh/id_ed25519}"

SSH_OPTS=(-i "${GWADA_SSH_IDENTITY}" -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "root@${LIVE_VPS_HOST}" "$@"
}

COOLIFY_APP_ID="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
COMPOSE_ENV="/data/coolify/applications/${COOLIFY_APP_ID}/.env"

read_vps_env_key() {
  local key="$1"
  ssh_cmd "grep -E '^${key}=' '${COMPOSE_ENV}' 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"'" \
    || true
}

if ! ssh_cmd true 2>/dev/null; then
  echo "SSH zum Live-VPS fehlgeschlagen (${LIVE_VPS_HOST})." >&2
  exit 1
fi

export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-$(read_vps_env_key NEXT_PUBLIC_SUPABASE_URL)}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$(read_vps_env_key SUPABASE_SERVICE_ROLE_KEY)}"
export BUBBLE_API_TOKEN="${BUBBLE_API_TOKEN:-$(read_vps_env_key BUBBLE_API_TOKEN)}"
if [[ -z "${BUBBLE_API_TOKEN}" ]]; then
  export BUBBLE_API_TOKEN="$(
    ssh_cmd "grep -rhE '^BUBBLE_API_TOKEN=' /data/coolify/applications/ /root/ 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"'" \
      || true
  )"
fi
export GWADA_LEGACY_BUBBLE_URL="${GWADA_LEGACY_BUBBLE_URL:-$(read_vps_env_key GWADA_LEGACY_BUBBLE_URL)}"

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL}" || -z "${SUPABASE_SERVICE_ROLE_KEY}" ]]; then
  echo "NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt (VPS ${COMPOSE_ENV})." >&2
  exit 1
fi
if [[ -z "${BUBBLE_API_TOKEN}" ]]; then
  echo "BUBBLE_API_TOKEN fehlt — GitHub Secret BUBBLE_API_TOKEN oder VPS ${COMPOSE_ENV}." >&2
  exit 1
fi

args=("${DATE_YMD}")
if [[ "${DRY_RUN}" == "1" ]]; then
  args+=(--dry-run)
fi

node "${ROOT}/scripts/migrate-bubble-staff-times-day.mjs" "${args[@]}"
