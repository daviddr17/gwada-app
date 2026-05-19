#!/usr/bin/env bash
# Live: SSH-Tunnel (falls nötig) + supabase db push. Keine Seeds / kein db reset.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Optional: LIVE_TUNNEL_REMOTE_HOST aus .env.production (kein Secret)
if [[ -f .env.production ]]; then
  # shellcheck disable=SC1091
  set -a
  # nur Tunnel-Variablen, nicht das ganze File (Sonderzeichen in URLs)
  while IFS= read -r line; do
    case "$line" in
      LIVE_TUNNEL_REMOTE_HOST=*|LIVE_VPS_HOST=*|LIVE_SSH_USER=*|LIVE_TUNNEL_LOCAL_PORT=*|LIVE_TUNNEL_REMOTE_PORT=*)
        [[ "$line" =~ ^# ]] && continue
        export "$line"
        ;;
    esac
  done < .env.production
  set +a
fi

# shellcheck source=scripts/tunnel-live-lib.sh
source "${ROOT}/scripts/tunnel-live-lib.sh"

WITH_DATA=0
DRY_RUN=()
for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=(--dry-run) ;;
    --with-data) WITH_DATA=1 ;;
  esac
done

cleanup() {
  gwada_tunnel_stop
}
trap cleanup EXIT INT TERM

if ! command -v supabase >/dev/null 2>&1 && ! npx supabase --version >/dev/null 2>&1; then
  echo "Supabase CLI fehlt." >&2
  exit 1
fi

if ! grep -q '^SUPABASE_DB_URL=' .env.production 2>/dev/null; then
  echo "SUPABASE_DB_URL fehlt in .env.production — zuerst npm run db:setup:live-url" >&2
  exit 1
fi

if ! gwada_ssh_cmd -o ConnectTimeout=8 "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" true 2>/dev/null; then
  echo "" >&2
  echo "SSH ohne Passwort-Abfrage fehlgeschlagen (BatchMode)." >&2
  echo "Einmalig einrichten, dann klappt „live deployen“ automatisch:" >&2
  echo "  ssh-copy-id ${LIVE_SSH_USER}@${LIVE_VPS_HOST}" >&2
  echo "" >&2
  echo "Alternativ: Terminal 1: npm run db:tunnel:live  |  Terminal 2: npm run db:push:live" >&2
  exit 1
fi

gwada_tunnel_start_bg

echo ""
echo "=== Live-DB: Migrationen anwenden (nur Schema) ==="
if [[ ${#DRY_RUN[@]} -gt 0 ]]; then
  dotenv -e .env.production -- bash scripts/db-push-live.sh --dry-run
else
  dotenv -e .env.production -- bash scripts/db-push-live.sh
fi

if [[ "${WITH_DATA}" -eq 1 ]]; then
  if [[ ${#DRY_RUN[@]} -gt 0 ]]; then
    echo "(Dry-run: Daten-Sync übersprungen.)"
  else
    echo ""
    echo "=== Live-DB: Daten von lokal (public) ==="
    dotenv -e .env.production -- bash "${ROOT}/scripts/live-sync-data.sh"
  fi
fi

echo ""
echo "=== Live-DB fertig ==="
