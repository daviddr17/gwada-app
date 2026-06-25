#!/usr/bin/env bash
# Live-DB-Push nur mit expliziter Bestätigung (Schutz vor Versehen).
set -euo pipefail

if [[ -z "${GWADA_CONFIRM_LIVE_DB:-}" ]]; then
  echo "" >&2
  echo "⛔ Live-DB-Push blockiert." >&2
  echo "" >&2
  echo "Standard ist die Entwickler-DB:  pnpm db:push" >&2
  echo "Live nur bei expliziter Anfrage:  GWADA_CONFIRM_LIVE_DB=1 pnpm db:push:live" >&2
  echo "" >&2
  exit 1
fi

exec dotenv -e .env.production -- bash scripts/db-push-live.sh "$@"
