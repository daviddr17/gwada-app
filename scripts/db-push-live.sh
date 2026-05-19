#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL fehlt in .env.production — siehe docs/supabase-lokal-und-live.md"
  echo ""
  echo "Beispiel (POSTGRES_PASSWORD aus Coolify; Host = VPS-IP, nicht supabase-db):"
  echo "  SUPABASE_DB_URL=postgresql://postgres:DEIN_PASSWORT@95.111.229.250:5432/postgres"
  exit 1
fi

# Self-hosted Postgres über SSH-Tunnel: kein TLS auf der DB-Verbindung
export PGSSLMODE="${PGSSLMODE:-disable}"

DB_URL="${SUPABASE_DB_URL}"
if [[ "${DB_URL}" != *sslmode=* ]]; then
  if [[ "${DB_URL}" == *"?"* ]]; then
    DB_URL="${DB_URL}&sslmode=disable"
  else
    DB_URL="${DB_URL}?sslmode=disable"
  fi
fi

exec supabase db push --db-url "${DB_URL}" "$@"
