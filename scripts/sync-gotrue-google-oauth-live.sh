#!/usr/bin/env bash
# Spiegelt google_oauth aus der Live-DB in GoTrue (VPS) — Voraussetzung: SSH ohne Passwort.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
STAGING_ORIGIN="${APP_ORIGIN:-https://new.gwada.app}"

# shellcheck source=scripts/gwada-ssh-lib.sh
source "$(dirname "$0")/gwada-ssh-lib.sh"

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
else
  DRY_RUN=0
fi

cfg_json="$(node "$(dirname "$0")/read-google-oauth-config.mjs")"
client_id="$(node -e "const j=JSON.parse(process.argv[1]);console.log(j.clientId)" "${cfg_json}")"
client_secret="$(node -e "const j=JSON.parse(process.argv[1]);console.log(j.clientSecret)" "${cfg_json}")"

echo "→ Google OAuth aus Live-DB: Client-ID ${client_id:0:20}…"
echo "→ Ziel-VPS: ${SSH_USER}@${VPS}"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "[dry-run] Würde GOTRUE_EXTERNAL_GOOGLE_* setzen und Auth-Container neu starten."
  exit 0
fi

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${client_id}" "${client_secret}" "${STAGING_ORIGIN}" <<'REMOTE'
set -euo pipefail
client_id="$1"
client_secret="$2"
staging="$3"

google_callback="${staging}/api/auth/google/callback"
auth_callback="${staging}/auth/callback"

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

  # Optional: gleiche Namen wie Supabase CLI lokal
  upsert "SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID" "${client_id}"
  upsert "SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET" "${client_secret}"

  # Allow-List um App-Google-Callback erweitern (bestehende Einträge behalten)
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

echo "  Suche Supabase/GoTrue .env…"
for dir in /data/coolify/services/* /data/coolify/applications/*; do
  [[ -d "${dir}" ]] || continue
  patch_env_file "${dir}/.env"
done

echo "  Starte Auth-Container neu…"
auth_names="$(docker ps --format '{{.Names}}' | grep -iE 'auth|gotrue' || true)"
while IFS= read -r c; do
  [[ -z "${c}" ]] && continue
  docker restart "${c}" >/dev/null 2>&1 && echo "    ✓ restart ${c}" || echo "    ⚠ restart ${c} fehlgeschlagen" >&2
done <<< "${auth_names}"

echo "  Fertig. Prüfe: curl -s https://new.gwada.app/sb/auth/v1/settings (google: true)"
REMOTE

echo ""
echo "✓ GoTrue-Sync ausgeführt. Bitte testen: https://new.gwada.app/login → Mit Google anmelden"
