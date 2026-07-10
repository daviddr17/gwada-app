#!/usr/bin/env bash
# Live: GoTrue auf Passkey-fähige Version heben + WebAuthn-Env setzen.
# Passkeys brauchen supabase/gotrue >= v2.188 (Auth-Flow ab v2.188.0).
set -euo pipefail

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
GOTRUE_TARGET_VERSION="${GOTRUE_TARGET_VERSION:-v2.191.0}"
GOTRUE_IMAGE="supabase/gotrue:${GOTRUE_TARGET_VERSION}"

# shellcheck source=scripts/gwada-ssh-lib.sh
source "$(dirname "$0")/gwada-ssh-lib.sh"

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${GOTRUE_IMAGE}" <<'REMOTE'
set -euo pipefail
gotrue_image="$1"
rp_id="gwada.app"
rp_display="gwada"
rp_origins="https://gwada.app"

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

patch_compose_gotrue_image() {
  local compose_file="$1"
  [[ -f "${compose_file}" ]] || return 0
  grep -q 'supabase/gotrue:' "${compose_file}" 2>/dev/null || return 0
  sed -i -E "s|supabase/gotrue:v[0-9]+\.[0-9]+\.[0-9]+|${gotrue_image}|g" "${compose_file}"
  sed -i -E "s|supabase/gotrue:[^ \"']+|${gotrue_image}|g" "${compose_file}"
  echo "    ✓ ${compose_file} → ${gotrue_image}"
}

echo "→ GoTrue-Image: ${gotrue_image}"
echo "→ Passkey RP: ${rp_id}"

for dir in /data/coolify/services/* /data/coolify/applications/* /opt/gwada-dev-supabase; do
  [[ -d "${dir}" ]] || continue
  patch_env_file "${dir}/.env"
  patch_compose_gotrue_image "${dir}/docker-compose.yml"
  patch_compose_gotrue_image "${dir}/compose.yaml"
done

restarted=0
auth_container="$(docker ps --format '{{.Names}}' | grep -iE 'supabase-auth' | head -1 || true)"

if [[ -n "${auth_container}" ]]; then
  workdir="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "${auth_container}" 2>/dev/null || true)"
  service="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "${auth_container}" 2>/dev/null || true)"
  if [[ -n "${workdir}" && -n "${service}" && -d "${workdir}" ]]; then
    echo "  Pull + recreate ${service} in ${workdir}…"
    if (cd "${workdir}" && docker compose pull "${service}" && docker compose up -d --force-recreate --no-deps "${service}"); then
      restarted=1
    fi
  fi
fi

if [[ "${restarted}" != "1" ]]; then
  for dir in /data/coolify/services/*; do
    [[ -d "${dir}" ]] || continue
    grep -q 'GOTRUE_PASSKEY_ENABLED=true' "${dir}/.env" 2>/dev/null || continue
    for svc in auth gotrue supabase-auth; do
      if (cd "${dir}" && docker compose pull "${svc}" 2>/dev/null && docker compose up -d --force-recreate --no-deps "${svc}" 2>&1); then
        restarted=1
        break 2
      fi
    done
  done
fi

if [[ "${restarted}" != "1" ]]; then
  echo "::error::Auth-Container konnte nicht neu erstellt werden." >&2
  exit 1
fi

sleep 8
auth_container="$(docker ps --format '{{.Names}}' | grep -iE 'supabase-auth' | head -1 || true)"
if [[ -n "${auth_container}" ]]; then
  version="$(docker exec "${auth_container}" wget -qO- http://localhost:9999/health 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || true)"
  passkey_enabled="$(docker exec "${auth_container}" printenv GOTRUE_PASSKEY_ENABLED 2>/dev/null || true)"
  rp="$(docker exec "${auth_container}" printenv GOTRUE_WEBAUTHN_RP_ID 2>/dev/null || true)"
  echo "    ✓ GoTrue ${version:-?}, PASSKEY=${passkey_enabled:-?}, RP_ID=${rp:-?}"
fi
REMOTE

echo "✓ GoTrue Passkey-Upgrade Remote ausgeführt."
