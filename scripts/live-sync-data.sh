#!/usr/bin/env bash
# Kopiert Daten von lokaler Supabase-CLI-DB → Live (via SUPABASE_DB_URL / Tunnel).
# Destruktiv auf Live. SYNC_INCLUDE_AUTH=1 kopiert zusätzlich auth (Login).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOCAL_URL="${LOCAL_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL fehlt in .env.production" >&2
  exit 1
fi

# Nur Restaurant verknüpfen (npm run fix:live:workspace)
if [[ "${SYNC_WORKSPACE_ONLY:-0}" == "1" ]]; then
  if [[ -f .env.production ]]; then
    set -a
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
  cleanup() { gwada_tunnel_stop; }
  trap cleanup EXIT INT TERM
  gwada_ssh_cmd -o ConnectTimeout=8 "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" true || {
    echo "SSH: ssh-copy-id ${LIVE_SSH_USER}@${LIVE_VPS_HOST}" >&2
    exit 1
  }
  gwada_tunnel_start_bg
  REMOTE_DOCKER_URL="${SUPABASE_DB_URL}"
  if command -v docker >/dev/null 2>&1; then
    local_port="${LIVE_TUNNEL_LOCAL_PORT:-5433}"
    REMOTE_DOCKER_URL="$(echo "${SUPABASE_DB_URL}" | sed -E "s@127\\.0\\.0\\.1:${local_port}@host.docker.internal:${local_port}@")"
    docker run --rm -i postgres:17 psql "${REMOTE_DOCKER_URL}?sslmode=disable" -v ON_ERROR_STOP=1 \
      < "${ROOT}/scripts/ensure-demo-workspace.sql"
  else
    psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 < "${ROOT}/scripts/ensure-demo-workspace.sql"
  fi
  echo "✓ Demo-Workspace auf Live verknüpft (gwada-demo ↔ dreyer@techlion.de)."
  exit 0
fi

REMOTE_URL="${SUPABASE_DB_URL}"
if [[ "${REMOTE_URL}" != *sslmode=* ]]; then
  REMOTE_URL="${REMOTE_URL}?$([[ "${REMOTE_URL}" == *"?"* ]] && echo '&' || echo '')sslmode=disable"
fi

# Homebrew libpq (oft nicht im PATH)
export PATH="/opt/homebrew/opt/libpq/bin:/usr/local/opt/libpq/bin:${PATH}"

LOCAL_DB_CONTAINER="${LOCAL_DB_CONTAINER:-}"
if [[ -z "${LOCAL_DB_CONTAINER}" ]]; then
  LOCAL_DB_CONTAINER="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E 'supabase_db_|_db_' | head -1 || true)"
fi

use_docker_pg=0
if ! command -v pg_dump >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  if [[ -n "${LOCAL_DB_CONTAINER}" ]] && command -v docker >/dev/null 2>&1; then
    use_docker_pg=1
    echo "pg_dump/psql nicht im PATH — nutze Docker (${LOCAL_DB_CONTAINER} / postgres:17)."
  else
    echo "pg_dump/psql fehlt." >&2
    echo "  brew install libpq && brew link --force libpq" >&2
    echo "  oder Docker starten (supabase + docker CLI)." >&2
    exit 1
  fi
fi

pg_dump_local() {
  if [[ "${use_docker_pg}" -eq 0 ]]; then
    pg_dump "$@"
  else
    docker exec "${LOCAL_DB_CONTAINER}" pg_dump -U postgres "$@"
  fi
}

psql_local() {
  if [[ "${use_docker_pg}" -eq 0 ]]; then
    psql "$@"
  else
    docker exec -i "${LOCAL_DB_CONTAINER}" psql -U postgres "$@"
  fi
}

psql_remote() {
  if [[ "${use_docker_pg}" -eq 0 ]]; then
    psql "$@"
  else
    docker run --rm -i postgres:17 psql "$@"
  fi
}

if [[ "${use_docker_pg}" -eq 0 ]]; then
  if ! psql "${LOCAL_URL}" -c "select 1" >/dev/null 2>&1; then
    echo "Lokale DB nicht erreichbar. Bitte: npm run db:start" >&2
    exit 1
  fi
else
  if ! docker exec "${LOCAL_DB_CONTAINER}" psql -U postgres -c "select 1" >/dev/null 2>&1; then
    echo "Lokale Supabase-DB-Container nicht bereit. Bitte: npm run db:start" >&2
    exit 1
  fi
fi

# Tunnel auf dem Mac → host.docker.internal:5433 (siehe LIVE_TUNNEL_LOCAL_PORT)
REMOTE_DOCKER_URL="${REMOTE_URL}"
if [[ "${use_docker_pg}" -eq 1 ]]; then
  local_port="${LIVE_TUNNEL_LOCAL_PORT:-5433}"
  REMOTE_DOCKER_URL="$(echo "${REMOTE_URL}" | sed -E "s@127\\.0\\.0\\.1:${local_port}@host.docker.internal:${local_port}@")"
fi

if ! psql_remote "${REMOTE_DOCKER_URL}" -c "select 1" >/dev/null 2>&1; then
  echo "Live-DB nicht erreichbar (Tunnel auf Port ${LIVE_TUNNEL_LOCAL_PORT:-5433}?)." >&2
  echo "  npm run db:tunnel:live   oder   npm run sync:live:data" >&2
  exit 1
fi

sanitize_dump() {
  local f="$1"
  # Live oft älter als lokale PG 17; pg_dump --disable-triggers erzeugt DISABLE/ENABLE ALL → Fehler auf Live
  sed -i.bak \
    -e '/^SET transaction_timeout/d' \
    -e '/^SET idle_in_transaction_session_timeout/d' \
    -e '/^SET lock_timeout/d' \
    -e '/^ALTER TABLE.*DISABLE TRIGGER ALL/d' \
    -e '/^ALTER TABLE.*ENABLE TRIGGER ALL/d' \
    -e '/^SELECT pg_catalog\.setval/d' \
    "${f}"
  rm -f "${f}.bak"
}

sync_schema() {
  local schema="$1"
  local dump="${TMPDIR:-/tmp}/gwada-${schema}-data-$$.sql"

  echo "Export ${schema} (data-only) von lokal …"
  if [[ "${use_docker_pg}" -eq 0 ]]; then
    pg_dump "${LOCAL_URL}" \
      --data-only \
      --schema="${schema}" \
      --no-owner \
      --no-privileges \
      -f "${dump}"
  else
    docker exec "${LOCAL_DB_CONTAINER}" pg_dump -U postgres \
      --data-only \
      --schema="${schema}" \
      --no-owner \
      --no-privileges \
      "postgres" > "${dump}"
  fi
  sanitize_dump "${dump}"

  echo "Leere ${schema}-Tabellen auf Live (ohne messages_* Partitionen) …"
  psql_remote "${REMOTE_DOCKER_URL}" -v ON_ERROR_STOP=1 <<SQL
DO \$\$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = '${schema}'
      AND tablename NOT IN ('schema_migrations', 'migrations')
      AND tablename NOT LIKE 'messages_%'
      AND to_regclass(format('${schema}.%I', tablename)) IS NOT NULL
      AND has_table_privilege(
        format('${schema}.%I', tablename),
        'TRUNCATE'
      )
  ) LOOP
    BEGIN
      EXECUTE format('TRUNCATE TABLE ${schema}.%I CASCADE', r.tablename);
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'skip truncate %.% (fehlt)', '${schema}', r.tablename;
    END;
  END LOOP;
END \$\$;
SQL

  echo "Import ${schema} auf Live (FK-Checks aus, superuser postgres nötig) …"
  {
    echo "SET session_replication_role = replica;"
    cat "${dump}"
    echo "SET session_replication_role = origin;"
  } | psql_remote "${REMOTE_DOCKER_URL}" -v ON_ERROR_STOP=1
  rm -f "${dump}"
  echo "✓ ${schema} kopiert."
}

table_exists_local() {
  local schema="$1" table="$2"
  if [[ "${use_docker_pg}" -eq 0 ]]; then
    psql "${LOCAL_URL}" -tAc \
      "select 1 from pg_tables where schemaname='${schema}' and tablename='${table}'" | grep -q 1
  else
    docker exec "${LOCAL_DB_CONTAINER}" psql -U postgres -tAc \
      "select 1 from pg_tables where schemaname='${schema}' and tablename='${table}'" | grep -q 1
  fi
}

table_exists_remote() {
  local schema="$1" table="$2"
  psql_remote "${REMOTE_DOCKER_URL}" -tAc \
    "select 1 from pg_tables where schemaname='${schema}' and tablename='${table}'" \
    | grep -q 1
}

# Für E-Mail/Passwort-Login reichen users + identities (ohne Sequenz-Probleme)
AUTH_LOGIN_TABLES=(users identities)
# Vor dem Import leeren (ohne RESTART IDENTITY — sonst Owner-Fehler bei Sequenzen)
AUTH_TRUNCATE_TABLES=(
  refresh_tokens
  sessions
  identities
  mfa_amr_claims
  mfa_challenges
  mfa_factors
  one_time_tokens
  flow_state
  users
)

sync_auth_for_login() {
  local dump="${TMPDIR:-/tmp}/gwada-auth-login-$$.sql"
  local table
  : > "${dump}"

  echo "Export auth (nur Login-Tabellen, ohne messages_*) …"
  for table in "${AUTH_LOGIN_TABLES[@]}"; do
    if ! table_exists_local auth "${table}"; then
      echo "  überspringe auth.${table} (lokal nicht vorhanden)"
      continue
    fi
    if ! table_exists_remote auth "${table}"; then
      echo "  überspringe auth.${table} (auf Live nicht vorhanden)"
      continue
    fi
    echo "  + auth.${table}"
    local part="${TMPDIR:-/tmp}/gwada-auth-${table}-$$.sql"
    if [[ "${use_docker_pg}" -eq 0 ]]; then
      pg_dump "${LOCAL_URL}" \
        --data-only \
        --table="auth.${table}" \
        --no-owner \
        --no-privileges \
        -f "${part}"
    else
      docker exec "${LOCAL_DB_CONTAINER}" pg_dump -U postgres \
        --data-only \
        --table="auth.${table}" \
        --no-owner \
        --no-privileges \
        "postgres" > "${part}"
    fi
    sanitize_dump "${part}"
    cat "${part}" >> "${dump}"
    rm -f "${part}"
  done

  if [[ ! -s "${dump}" ]]; then
    echo "Keine auth-Login-Tabellen zum Kopieren." >&2
    exit 1
  fi

  echo "Leere auth-Tabellen auf Live (ohne RESTART IDENTITY) …"
  local truncate_list=""
  local table
  for table in "${AUTH_TRUNCATE_TABLES[@]}"; do
    if table_exists_remote auth "${table}"; then
      truncate_list+="auth.${table},"
    fi
  done
  truncate_list="${truncate_list%,}"
  psql_remote "${REMOTE_DOCKER_URL}" -v ON_ERROR_STOP=1 \
    -c "TRUNCATE TABLE ${truncate_list} CASCADE;"

  echo "Import auth auf Live …"
  {
    echo "SET session_replication_role = replica;"
    cat "${dump}"
    echo "SET session_replication_role = origin;"
  } | psql_remote "${REMOTE_DOCKER_URL}" -v ON_ERROR_STOP=1
  rm -f "${dump}"

  echo "✓ auth (Login) kopiert."
  echo ""
  echo "Lokal-Demo (falls vorhanden): dreyer@techlion.de / GwadaLocal2026!"
  echo "Sonst: dieselben Zugangsdaten wie auf http://127.0.0.1:54323 (Auth → Users)."
}

if [[ "${SYNC_ONLY_AUTH:-0}" != "1" ]]; then
  sync_schema public
fi

if [[ "${SYNC_INCLUDE_AUTH:-0}" == "1" ]]; then
  sync_auth_for_login
  if [[ -f "${ROOT}/scripts/ensure-demo-workspace.sql" ]]; then
    echo ""
    echo "=== Restaurant-Zuordnung (gwada-demo) ==="
    psql_remote "${REMOTE_DOCKER_URL}" -v ON_ERROR_STOP=1 \
      < "${ROOT}/scripts/ensure-demo-workspace.sql"
  fi
else
  echo ""
  echo "Login-Nutzer nicht kopiert. Falls nötig: npm run sync:live:data:all"
fi
