#!/usr/bin/env bash
# GoTrue Redirect-URLs für new.gwada.app (+ gwada.app für späteren Cutover).
set -euo pipefail

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"

# shellcheck source=scripts/gwada-ssh-lib.sh
source "$(dirname "$0")/gwada-ssh-lib.sh"

STAGING_ORIGIN="${APP_ORIGIN:-https://new.gwada.app}"
PRODUCTION_ORIGIN="${GWADA_PLANNED_PRODUCTION_URL:-https://gwada.app}"

CALLBACKS=(
  "${STAGING_ORIGIN}/auth/callback"
  "${PRODUCTION_ORIGIN}/auth/callback"
)

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${STAGING_ORIGIN}" "${PRODUCTION_ORIGIN}" <<'REMOTE'
set -euo pipefail
staging="$1"
production="$2"

allow_list="${staging}/auth/callback,${production}/auth/callback,${staging},${production}"

echo "  Suche Auth/GoTrue-Container…"
auth_names="$(docker ps --format '{{.Names}}' | grep -iE 'auth|gotrue' || true)"

if [[ -z "${auth_names}" ]]; then
  echo "  Kein auth/gotrue-Container gefunden — ggf. Supabase-Stack anders benannt." >&2
  echo "  Manuell in Supabase/GoTrue ergänzen:" >&2
  echo "    ${allow_list}" >&2
  exit 0
fi

while IFS= read -r c; do
  [[ -z "$c" ]] && continue
  echo "  Patch ${c}…"

  # Compose-Env in Coolify-Supabase-Stacks (docker update unterstützt keine -e Env-Flags)
  for dir in /data/coolify/services/* /data/coolify/applications/*; do
    [[ -d "$dir" ]] || continue
    env_file="${dir}/.env"
    if [[ -f "$env_file" ]] && grep -qi 'gotrue\|supabase' "$env_file" 2>/dev/null; then
      if grep -q '^GOTRUE_URI_ALLOW_LIST=' "$env_file" 2>/dev/null; then
        sed -i "s|^GOTRUE_URI_ALLOW_LIST=.*|GOTRUE_URI_ALLOW_LIST=${allow_list}|" "$env_file"
      else
        echo "GOTRUE_URI_ALLOW_LIST=${allow_list}" >> "$env_file"
      fi
      if grep -q '^GOTRUE_SITE_URL=' "$env_file" 2>/dev/null; then
        sed -i "s|^GOTRUE_SITE_URL=.*|GOTRUE_SITE_URL=${staging}|" "$env_file"
      else
        echo "GOTRUE_SITE_URL=${staging}" >> "$env_file"
      fi
      echo "    .env aktualisiert: ${env_file}"
    fi
  done

  docker restart "$c" >/dev/null 2>&1 || true
done <<< "${auth_names}"

echo "  ✓ GoTrue: ${allow_list}"
REMOTE
