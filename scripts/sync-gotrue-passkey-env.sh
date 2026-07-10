#!/usr/bin/env bash
# Aktiviert Passkeys (WebAuthn) in GoTrue auf dem VPS — Dev oder Live.
# Voraussetzung: SSH ohne Passwort (siehe scripts/gwada-ssh-lib.sh).
#
# Usage:
#   bash scripts/sync-gotrue-passkey-env.sh dev
#   bash scripts/sync-gotrue-passkey-env.sh live
#   bash scripts/sync-gotrue-passkey-env.sh live --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

TARGET="${1:-dev}"
DRY_RUN=0
if [[ "${2:-}" == "--dry-run" || "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  if [[ "${1:-}" == "--dry-run" ]]; then
    TARGET="${2:-dev}"
  fi
fi

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"

case "${TARGET}" in
  dev)
    RP_ID="localhost"
    RP_DISPLAY="gwada"
    RP_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
    ;;
  live)
    RP_ID="gwada.app"
    RP_DISPLAY="gwada"
    RP_ORIGINS="https://gwada.app"
    ;;
  *)
    echo "Usage: $0 {dev|live} [--dry-run]" >&2
    exit 1
    ;;
esac

# shellcheck source=scripts/gwada-ssh-lib.sh
source "$(dirname "$0")/gwada-ssh-lib.sh"

echo "→ Passkeys in GoTrue (${TARGET}): rp_id=${RP_ID}"
echo "→ Ziel-VPS: ${SSH_USER}@${VPS}"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "[dry-run] Würde GOTRUE_PASSKEY_* / GOTRUE_WEBAUTHN_* setzen und Auth neu starten."
  exit 0
fi

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${RP_ID}" "${RP_DISPLAY}" "${RP_ORIGINS}" <<'REMOTE'
set -euo pipefail
rp_id="$1"
rp_display="$2"
rp_origins="$3"

patch_env_file() {
  local env_file="$1"
  [[ -f "${env_file}" ]] || return 0
  grep -qi 'gotrue\|supabase' "${env_file}" 2>/dev/null || return 0

  upsert() {
    local key="$1"
    local val="$2"
    if grep -q "^${key}=" "${env_file}" 2>/dev/null; then
      sed -i "s|^${key}=.*|${key}=${val}|" "${env_file}"
    else
      echo "${key}=${val}" >> "${env_file}"
    fi
  }

  upsert "GOTRUE_PASSKEY_ENABLED" "true"
  upsert "GOTRUE_WEBAUTHN_RP_ID" "${rp_id}"
  upsert "GOTRUE_WEBAUTHN_RP_DISPLAY_NAME" "${rp_display}"
  upsert "GOTRUE_WEBAUTHN_RP_ORIGINS" "${rp_origins}"

  echo "    ✓ ${env_file}"
}

echo "  Suche Supabase/GoTrue .env…"
for dir in /data/coolify/services/* /data/coolify/applications/* /opt/gwada-dev-supabase; do
  [[ -d "${dir}" ]] || continue
  patch_env_file "${dir}/.env"
done

restart_auth() {
  local c
  c="$(docker ps --format '{{.Names}}' | grep -E 'auth|gotrue' | head -1 || true)"
  if [[ -n "${c}" ]]; then
    echo "  Neustart ${c}…"
    docker restart "${c}" >/dev/null
    return 0
  fi
  return 1
}

if restart_auth; then
  echo "✓ GoTrue Passkey-Konfiguration angewendet."
else
  echo "⚠ Auth-Container nicht gefunden — .env aktualisiert, bitte Stack manuell neu starten." >&2
fi
REMOTE

echo "✓ Fertig. App: NEXT_PUBLIC_PASSKEY_ENABLED=true setzen und neu deployen."
