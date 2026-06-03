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

echo "  Starte Auth/GoTrue neu (force-recreate mit neuer .env)…"
restarted=0
auth_container="$(docker ps --format '{{.Names}}' | grep -iE 'supabase-auth' | head -1 || true)"

if [[ -n "${auth_container}" ]]; then
  workdir="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "${auth_container}" 2>/dev/null || true)"
  service="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "${auth_container}" 2>/dev/null || true)"
  if [[ -n "${workdir}" && -n "${service}" && -d "${workdir}" ]]; then
    echo "    ${workdir} → Service ${service}"
    if (cd "${workdir}" && docker compose up -d --force-recreate --no-deps "${service}"); then
      restarted=1
      echo "    ✓ compose force-recreate ${service}"
    else
      echo "    ⚠ compose recreate fehlgeschlagen" >&2
    fi
  fi
fi

if [[ "${restarted}" != "1" ]]; then
  for dir in /data/coolify/services/*; do
    [[ -d "${dir}" ]] || continue
    grep -q 'GOTRUE_EXTERNAL_GOOGLE_ENABLED=true' "${dir}/.env" 2>/dev/null || continue
    for svc in auth gotrue supabase-auth; do
      if (cd "${dir}" && docker compose up -d --force-recreate --no-deps "${svc}" 2>&1); then
        restarted=1
        echo "    ✓ compose recreate ${svc} in ${dir}"
        break 2
      fi
    done
  done
fi

if [[ -n "${auth_container}" ]]; then
  enabled="$(docker exec "${auth_container}" printenv GOTRUE_EXTERNAL_GOOGLE_ENABLED 2>/dev/null || true)"
  cid="$(docker exec "${auth_container}" printenv GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID 2>/dev/null || true)"
  if [[ "${enabled}" == "true" && -n "${cid}" ]]; then
    echo "    ✓ Container-Env: GOOGLE_ENABLED=true, CLIENT_ID=${cid:0:20}…"
  else
    echo "    ⚠ Container-Env noch ohne Google (enabled=${enabled:-leer})" >&2
  fi
fi

if [[ "${restarted}" != "1" ]]; then
  echo "::error::Auth-Container konnte nicht mit neuer Env neu erstellt werden." >&2
  exit 1
fi

sleep 6
REMOTE

echo ""
echo "✓ Remote-Sync ausgeführt."
