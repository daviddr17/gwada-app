#!/usr/bin/env bash
# Liefert Live-Build-Args für docker build (GHA oder lokal).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

COOLIFY_APP_ID="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
VPS="${LIVE_VPS_HOST:-}"
COMPOSE_ENV="/data/coolify/applications/${COOLIFY_APP_ID}/.env"

read_env_from_vps() {
  local key="$1"
  [[ -n "${VPS}" ]] || return 1
  [[ -n "${LIVE_SSH_KEY:-}" ]] || return 1

  mkdir -p ~/.ssh
  printf '%s\n' "${LIVE_SSH_KEY}" > ~/.ssh/id_ed25519
  chmod 600 ~/.ssh/id_ed25519
  ssh-keyscan -H "${VPS}" >> ~/.ssh/known_hosts 2>/dev/null || true
  export GWADA_SSH_IDENTITY=~/.ssh/id_ed25519
  export GWADA_SSH_BATCH=1

  gwada_ssh "root@${VPS}" \
    "grep -E '^${key}=' '${COMPOSE_ENV}' 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\"'" \
    || true
}

ANON="${LIVE_NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
UPSTREAM="${LIVE_SUPABASE_UPSTREAM_URL:-}"

if [[ -z "${ANON}" ]]; then
  ANON="$(read_env_from_vps NEXT_PUBLIC_SUPABASE_ANON_KEY)"
fi
if [[ -z "${UPSTREAM}" ]]; then
  UPSTREAM="$(read_env_from_vps SUPABASE_UPSTREAM_URL)"
fi
UPSTREAM="${UPSTREAM:-http://supabase-kong-oogd5syyxiqb1k4g0wy1u9n8:8000}"

if [[ -z "${ANON}" ]]; then
  echo "::error::NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt (GitHub Secret LIVE_NEXT_PUBLIC_SUPABASE_ANON_KEY oder VPS ${COMPOSE_ENV})." >&2
  exit 1
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "anon_key=${ANON}"
    echo "supabase_upstream=${UPSTREAM}"
  } >> "${GITHUB_OUTPUT}"
else
  printf 'anon_key=%q\n' "${ANON}"
  printf 'supabase_upstream=%q\n' "${UPSTREAM}"
fi
