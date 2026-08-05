#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env.development ]]; then
  echo ".env.development fehlt" >&2
  exit 1
fi
if ! nc -z 127.0.0.1 5434 2>/dev/null; then
  echo "Dev-DB-Tunnel down. Start: pnpm db:tunnel:dev" >&2
  exit 1
fi

SEED_FILE="$ROOT/supabase/seed_pos_solo_rich_menu_zurschlagd.sql"

run_psql() {
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$SEED_FILE"
}

DOTENV_BIN=""
if command -v dotenv >/dev/null 2>&1; then
  DOTENV_BIN="dotenv"
elif [[ -x "$ROOT/node_modules/.bin/dotenv" ]]; then
  DOTENV_BIN="$ROOT/node_modules/.bin/dotenv"
fi

if [[ -n "$DOTENV_BIN" ]]; then
  "$DOTENV_BIN" -e .env.development -- bash -c 'psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "'"$SEED_FILE"'"'
else
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^SUPABASE_DB_URL=' .env.development)
  set +a
  if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
    echo "SUPABASE_DB_URL fehlt" >&2
    exit 1
  fi
  run_psql
fi

echo "✓ seed_pos_solo_rich_menu applied (Dev)"
