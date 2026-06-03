#!/usr/bin/env bash
# GoTrue Google OAuth: Credentials aus Live-Postgres auf dem VPS, dann GoTrue .env patchen.
# Nur SSH nötig (LIVE_SSH_KEY in CI oder ssh-copy-id lokal).
set -euo pipefail

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
STAGING_ORIGIN="${APP_ORIGIN:-https://new.gwada.app}"

# shellcheck source=scripts/gwada-ssh-lib.sh
source "$(dirname "$0")/gwada-ssh-lib.sh"

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${STAGING_ORIGIN}" <<'REMOTE'
set -euo pipefail
staging="$1"
google_callback="${staging}/api/auth/google/callback"
auth_callback="${staging}/auth/callback"

db_container="$(docker ps --format '{{.Names}}' | grep -E 'supabase-db|supabase.*db' | head -1 || true)"
if [[ -z "${db_container}" ]]; then
  echo "::error::Kein Postgres-Container (supabase-db) gefunden." >&2
  exit 1
fi
echo "  DB-Container: ${db_container}"

row="$(docker exec "${db_container}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -tA -F $'\t' -c \
  "SELECT config->>'client_id', config->>'client_secret'
   FROM public.platform_integrations
   WHERE key = 'google_oauth' AND enabled IS TRUE
   LIMIT 1;")"

client_id="${row%%$'\t'*}"
client_secret="${row#*$'\t'}"

if [[ -z "${client_id}" || -z "${client_secret}" ]]; then
  echo "::error::google_oauth nicht aktiv oder Client-ID/Secret fehlt in platform_integrations." >&2
  exit 1
fi

echo "  Client-ID: ${client_id:0:24}…"

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

  upsert "GOTRUE_EXTERNAL_GOOGLE_ENABLED" "true"
  upsert "GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID" "${client_id}"
  upsert "GOTRUE_EXTERNAL_GOOGLE_SECRET" "${client_secret}"
  upsert "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID" "${client_id}"
  upsert "SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET" "${client_secret}"

  if grep -q '^GOTRUE_URI_ALLOW_LIST=' "${env_file}" 2>/dev/null; then
    current="$(grep '^GOTRUE_URI_ALLOW_LIST=' "${env_file}" | head -1 | cut -d= -f2-)"
    case ",${current}," in
      *,"${google_callback}",*) ;;
      *)
        if [[ -n "${current}" ]]; then
          upsert "GOTRUE_URI_ALLOW_LIST" "${current},${google_callback},${auth_callback}"
        else
          upsert "GOTRUE_URI_ALLOW_LIST" "${google_callback},${auth_callback},${staging}"
        fi
        ;;
    esac
  else
    upsert "GOTRUE_URI_ALLOW_LIST" "${google_callback},${auth_callback},${staging}"
  fi

  echo "    ✓ ${env_file}"
}

echo "  Patche Supabase/GoTrue .env…"
for dir in /data/coolify/services/* /data/coolify/applications/*; do
  [[ -d "${dir}" ]] || continue
  patch_env_file "${dir}/.env"
done

echo "  Starte Auth/GoTrue neu (Compose + Container)…"
restarted=0
for dir in /data/coolify/services/*; do
  [[ -d "${dir}" ]] || continue
  [[ -f "${dir}/docker-compose.yml" || -f "${dir}/compose.yaml" ]] || continue
  if ! grep -q 'GOTRUE_EXTERNAL_GOOGLE_ENABLED=true' "${dir}/.env" 2>/dev/null; then
    continue
  fi
  echo "    Compose in ${dir}…"
  if (cd "${dir}" && docker compose up -d --force-recreate --no-deps auth 2>/dev/null); then
    restarted=1
    echo "    ✓ compose recreate auth"
  elif (cd "${dir}" && docker compose up -d --force-recreate --no-deps gotrue 2>/dev/null); then
    restarted=1
    echo "    ✓ compose recreate gotrue"
  fi
done

auth_names="$(docker ps --format '{{.Names}}' | grep -iE 'supabase-auth|supabase.*-auth-|gotrue' || true)"
while IFS= read -r c; do
  [[ -z "${c}" ]] && continue
  docker restart "${c}" >/dev/null 2>&1 && echo "    ✓ restart ${c}" && restarted=1 || echo "    ⚠ restart ${c}" >&2
done <<< "${auth_names}"

if [[ "${restarted}" != "1" ]]; then
  echo "::warning::Kein Auth-Container neu gestartet — ggf. manuell: cd /data/coolify/services/<supabase> && docker compose up -d --force-recreate auth" >&2
fi

sleep 5
REMOTE

echo ""
echo "✓ Remote-Sync ausgeführt."
