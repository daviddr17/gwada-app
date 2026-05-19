#!/usr/bin/env bash
# Kopiert Daten (public) von lokaler Supabase-CLI-DB → Live (via SUPABASE_DB_URL / Tunnel).
# Destruktiv auf Live: leert public-Tabellen vor dem Import. Nur auf ausdrückliche Anfrage.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOCAL_URL="${LOCAL_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL fehlt in .env.production" >&2
  exit 1
fi

REMOTE_URL="${SUPABASE_DB_URL}"
if [[ "${REMOTE_URL}" != *sslmode=* ]]; then
  REMOTE_URL="${REMOTE_URL}?$([[ "${REMOTE_URL}" == *"?"* ]] && echo '&' || echo '')sslmode=disable"
fi

for cmd in pg_dump psql; do
  command -v "${cmd}" >/dev/null 2>&1 || {
    echo "${cmd} fehlt (z. B. brew install libpq && brew link --force libpq)" >&2
    exit 1
  }
done

if ! pg_isready -h 127.0.0.1 -p 54322 -U postgres >/dev/null 2>&1; then
  echo "Lokale DB nicht erreichbar. Bitte: npm run db:start" >&2
  exit 1
fi

if ! psql "${REMOTE_URL}" -c "select 1" >/dev/null 2>&1; then
  echo "Live-DB nicht erreichbar (Tunnel? npm run db:tunnel:live oder npm run deploy:live zuerst)." >&2
  exit 1
fi

DUMP="${TMPDIR:-/tmp}/gwada-public-data-$$.sql"
echo "Export public (data-only) von lokal …"
pg_dump "${LOCAL_URL}" \
  --data-only \
  --schema=public \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  -f "${DUMP}"

echo "Leere public-Tabellen auf Live (CASCADE) …"
psql "${REMOTE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('schema_migrations', 'supabase_migrations')
  ) LOOP
    EXECUTE format('TRUNCATE TABLE public.%I CASCADE', r.tablename);
  END LOOP;
END $$;
SQL

echo "Import Daten auf Live …"
psql "${REMOTE_URL}" -v ON_ERROR_STOP=1 -f "${DUMP}"

rm -f "${DUMP}"
echo "✓ public-Daten von lokal nach Live kopiert."
echo "Hinweis: auth.users / Storage wurden nicht migriert — nur public."
