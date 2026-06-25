#!/usr/bin/env bash
# Prüft Demo-Login über GoTrue (nicht nur psql).
set -euo pipefail

compose_dir="${1:-/opt/gwada-supabase-dev}"
kong_port="${2:-8100}"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

read_env_key() {
  grep -m1 "^${1}=" .env | sed "s/^${1}=//" | tr -d '\r\n'
}

ANON_KEY="$(read_env_key ANON_KEY)"
SERVICE_ROLE_KEY="$(read_env_key SERVICE_ROLE_KEY)"
AUTH_BASE="http://127.0.0.1:${kong_port}/auth/v1"

for i in $(seq 1 30); do
  if curl -sf "${AUTH_BASE}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

admin_json="$(curl -sf "${AUTH_BASE}/admin/users?per_page=10" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}")"
admin_count="$(printf '%s' "${admin_json}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('users',[])))")"

login_json="$(curl -sf -X POST "${AUTH_BASE}/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"email":"dreyer@techlion.de","password":"GwadaLocal2026!"}')" || {
  echo "FEHLER: Demo-Login fehlgeschlagen (GoTrue)." >&2
  echo "       Admin-User sichtbar: ${admin_count}" >&2
  exit 1
}

printf '%s' "${login_json}" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get('access_token') else 1)" \
  || { echo "FEHLER: Kein access_token in Login-Antwort." >&2; exit 1; }

echo "✓ Demo-Login OK (GoTrue: ${admin_count} User, dreyer@techlion.de)."
