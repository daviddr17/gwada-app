#!/usr/bin/env bash
# CI / GitHub Actions: SSH-Tunnel + supabase db push (ohne .env.production auf dem Runner).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/tunnel-live-lib.sh
source "${ROOT}/scripts/tunnel-live-lib.sh"

cleanup() {
  gwada_tunnel_stop
}
trap cleanup EXIT INT TERM

if ! command -v supabase >/dev/null 2>&1 && ! npx supabase --version >/dev/null 2>&1; then
  echo "Supabase CLI fehlt." >&2
  exit 1
fi

if ! gwada_ssh_cmd -o ConnectTimeout=8 "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" true 2>/dev/null; then
  echo "SSH zum VPS fehlgeschlagen." >&2
  exit 1
fi

gwada_tunnel_start_bg

DB_CONTAINER="$(
  gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" \
    "docker ps --format '{{.Names}}' | grep '${LIVE_DB_CONTAINER_GREP}' | head -1"
)"
DB_CONTAINER="${DB_CONTAINER//$'\r'/}"
if [[ -z "${DB_CONTAINER}" ]]; then
  echo "Supabase-DB-Container nicht gefunden." >&2
  exit 1
fi

# Passwort nicht rotieren und nicht loggen. Der Container-Env-Wert ist nur der
# Init-Wert; Coolify SERVICE_PASSWORD_POSTGRES kann der echte Rolle-Wert sein.
# TCP-Prüfung geht auf die Container-IP (nicht 127.0.0.1/trust).
echo "Postgres-Login prüfen (ohne Passwort im Log) …"
POSTGRES_PASSWORD="$(
  gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" bash -s -- "${DB_CONTAINER}" <<'REMOTE'
set -euo pipefail
db="$1"
db_ip="$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "${db}" | awk '{print $1}')"
if [[ -z "${db_ip}" ]]; then
  echo "Container-IP fehlt." >&2
  exit 1
fi
if ! docker exec "${db}" psql --version >/dev/null 2>&1; then
  echo "psql im DB-Container fehlt." >&2
  exit 1
fi

read_env() {
  local file="$1" key="$2" line val
  [[ -f "${file}" ]] || return 0
  line="$(grep -m1 "^${key}=" "${file}" || true)"
  [[ -n "${line}" ]] || return 0
  val="${line#"${key}="}"
  val="${val%$'\r'}"
  if [[ "${val}" == \"*\" ]]; then val="${val#\"}"; val="${val%\"}"; fi
  if [[ "${val}" == \'*\' ]]; then val="${val#\'}"; val="${val%\'}"; fi
  if [[ "${val}" =~ ^\$\{.*\}$ ]]; then
    return 0
  fi
  printf '%s' "${val}"
}

describe_pw() {
  local pw="$1" flags=""
  [[ "${pw}" == *@* ]] && flags+="@ "
  [[ "${pw}" == *'#'* ]] && flags+="# "
  [[ "${pw}" == *'?'* ]] && flags+="? "
  [[ "${pw}" == *%* ]] && flags+="% "
  [[ "${pw}" == *'/'* ]] && flags+="/ "
  [[ "${pw}" == *' '* ]] && flags+="space "
  echo "len=${#pw} url_specials=${flags:-none}" >&2
}

tried=()
try_candidate() {
  local label="$1" pw="$2" prev
  if [[ -z "${pw}" ]]; then
    echo "candidate ${label}: empty" >&2
    return 1
  fi
  if ((${#tried[@]})); then
    for prev in "${tried[@]}"; do
      if [[ "${prev}" == "${pw}" ]]; then
        echo "candidate ${label}: same as earlier candidate" >&2
        return 1
      fi
    done
  fi
  tried+=("${pw}")
  echo -n "candidate ${label}: " >&2
  describe_pw "${pw}"
  if docker exec -e PGPASSWORD="${pw}" "${db}" \
    psql -h "${db_ip}" -U postgres -d postgres -v ON_ERROR_STOP=1 -tAc 'select 1' \
    >/dev/null 2>&1; then
    echo "candidate ${label}: tcp auth ok" >&2
    printf '%s' "${pw}"
    exit 0
  fi
  echo "candidate ${label}: tcp auth failed" >&2
  return 1
}

container_pw="$(docker exec "${db}" printenv POSTGRES_PASSWORD | tr -d '\r\n' || true)"
try_candidate container_env "${container_pw}" || true

workdir="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "${db}" 2>/dev/null || true)"
workdir="${workdir//$'\r'/}"
if [[ -n "${workdir}" && -f "${workdir}/.env" ]]; then
  try_candidate compose_postgres_password "$(read_env "${workdir}/.env" POSTGRES_PASSWORD)" || true
  try_candidate compose_service_password "$(read_env "${workdir}/.env" SERVICE_PASSWORD_POSTGRES)" || true
fi

while IFS= read -r envf; do
  [[ -n "${envf}" ]] || continue
  try_candidate coolify_service_password "$(read_env "${envf}" SERVICE_PASSWORD_POSTGRES)" || true
done < <(find /data/coolify -name '.env' -type f 2>/dev/null || true)

echo "Kein Postgres-Passwort aus Container-Env oder Coolify hat per TCP gepasst. Passwort wird nicht geändert." >&2
if docker exec "${db}" psql -U postgres -d postgres -tAc 'select 1' >/dev/null 2>&1; then
  echo "local socket: ok" >&2
else
  echo "local socket: failed" >&2
fi
docker exec "${db}" sh -c 'if [ -n "${PGDATA:-}" ] && [ -f "${PGDATA}/pg_hba.conf" ]; then cat "${PGDATA}/pg_hba.conf"; fi' >&2 || true
exit 1
REMOTE
)"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD//$'\r'/}"
if [[ -z "${POSTGRES_PASSWORD}" ]]; then
  echo "Postgres-Login fehlgeschlagen." >&2
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${POSTGRES_PASSWORD}")"
else
  echo "python3 fehlt — Passwort kann nicht URL-kodiert werden." >&2
  exit 1
fi

if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
  # Workflow-Kommandos: % muss als %25 stehen, sonst maskiert das Log falsch.
  mask_pw="${POSTGRES_PASSWORD//%/%25}"
  mask_enc="${ENC_PW//%/%25}"
  echo "::add-mask::${mask_pw}"
  echo "::add-mask::${mask_enc}"
  unset mask_pw mask_enc
fi

if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql-client >/dev/null
fi

echo "Tunnel-Login prüfen …"
if ! PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  "host=127.0.0.1 port=${LIVE_TUNNEL_LOCAL_PORT} user=postgres dbname=postgres sslmode=disable" \
  -v ON_ERROR_STOP=1 -tAc 'select 1' >/dev/null; then
  echo "Tunnel-Login fehlgeschlagen." >&2
  exit 1
fi
echo "Tunnel-Login ok."

export SUPABASE_DB_URL="postgresql://postgres:${ENC_PW}@127.0.0.1:${LIVE_TUNNEL_LOCAL_PORT}/postgres"
export PGSSLMODE=disable

# notification_events.relchecks ist auf Live 1, obwohl keine CHECK-Zeile da ist.
# ADD CONSTRAINT läuft dann auf den Unique-Index. postgres darf pg_class nicht
# schreiben; supabase_admin über den lokalen Socket schon. Keine Tabellendaten.
echo "Prüfe Check-Katalog (keine Tabellendaten) …"
gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" bash -s -- "${DB_CONTAINER}" <<'REMOTE'
set -euo pipefail
db="$1"
psql_admin() {
  docker exec "${db}" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 "$@"
}
psql_admin -c "
select c.relname || ' relchecks=' || c.relchecks || ' checks=' || (
  select count(*) from pg_constraint k where k.conrelid = c.oid and k.contype = 'c'
)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'notification_events',
    'restaurant_staff_display_clock_notification_dismissals'
  )
order by 1;
"
need="$(psql_admin -tAc "
select exists (
  select 1
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'notification_events',
      'restaurant_staff_display_clock_notification_dismissals'
    )
    and c.relchecks is distinct from (
      select count(*)::int from pg_constraint k
      where k.conrelid = c.oid and k.contype = 'c'
    )
);
")"
need="${need//$'\r'/}"
need="${need//[[:space:]]/}"
if [[ "${need}" != "t" ]]; then
  echo "Check-Katalog passt."
  exit 0
fi
echo "relchecks weicht ab — Constraint-Index neu aufbauen und Zähler angleichen."
psql_admin -c "REINDEX INDEX pg_catalog.pg_constraint_conrelid_contypid_conname_index;"
psql_admin -c "
update pg_class c
set relchecks = (
  select count(*)::int from pg_constraint k
  where k.conrelid = c.oid and k.contype = 'c'
)
from pg_namespace n
where n.oid = c.relnamespace
  and n.nspname = 'public'
  and c.relname in (
    'notification_events',
    'restaurant_staff_display_clock_notification_dismissals'
  )
  and c.relchecks is distinct from (
    select count(*)::int from pg_constraint k
    where k.conrelid = c.oid and k.contype = 'c'
  );
"
echo "Check-Katalog angeglichen."
REMOTE

# Die Pause-Checks lassen sich anlegen, aber der CLI-Insert in
# schema_migrations scheitert: Version 20260921121144 sitzt im Unique-Index,
# DELETE sieht keine Zeile. Deshalb hier autocommit (nur Constraints), danach
# den Historieneintrag sichtbar machen. Kein Löschen — sonst liefe die
# Migration bei jedem späteren Live-Deploy erneut.
admin_psql() {
  gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" \
    docker exec -i "${DB_CONTAINER}" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q "$@"
}
admin_tac() {
  local out
  out="$(printf '%s\n' "$1" | admin_psql -tA)"
  out="${out//$'\r'/}"
  out="${out//[[:space:]]/}"
  printf '%s' "${out}"
}
tunnel_tac() {
  local out
  out="$(printf '%s\n' "$1" | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    "host=127.0.0.1 port=${LIVE_TUNNEL_LOCAL_PORT} user=postgres dbname=postgres sslmode=disable" \
    -v ON_ERROR_STOP=1 -q -tA)"
  out="${out//$'\r'/}"
  out="${out//[[:space:]]/}"
  printf '%s' "${out}"
}

BREAK_VERSION="20260921121144"
BREAK_CHECKS_SQL="select count(*) from pg_constraint where (conname = 'notification_events_module_chk' and pg_get_constraintdef(oid) like '%staff_display_break_start%' and pg_get_constraintdef(oid) like '%staff_display_break_end%') or (conname = 'clock_dismiss_module_chk' and pg_get_constraintdef(oid) like '%staff_display_break_start%' and pg_get_constraintdef(oid) like '%staff_display_break_end%')"
BREAK_HISTORY_SQL="select count(*) from supabase_migrations.schema_migrations where version = '${BREAK_VERSION}'"

break_checks="$(admin_tac "${BREAK_CHECKS_SQL}")"
break_history="$(tunnel_tac "${BREAK_HISTORY_SQL}")"
echo "Pause-Checks vorhanden: ${break_checks}/2; History sichtbar: ${break_history}"
if [[ "${break_checks}" != "2" || "${break_history}" != "1" ]]; then
echo "Migration-History-Index neu aufbauen (keine Tabellendaten) …"
printf '%s\n' "set lock_timeout = '15s'; reindex table supabase_migrations.schema_migrations;" | admin_psql

break_checks="$(admin_tac "${BREAK_CHECKS_SQL}")"
echo "Pause-Checks nach Reindex: ${break_checks}/2"
if [[ "${break_checks}" != "2" ]]; then
  echo "Pause-Modul-Checks anwenden (nur Constraints, keine Zeilen) …"
  admin_psql --single-transaction -f - \
    < "${ROOT}/supabase/migrations/${BREAK_VERSION}_staff_display_break_notifications.sql"
  break_checks="$(admin_tac "${BREAK_CHECKS_SQL}")"
  echo "Pause-Checks nach Apply: ${break_checks}/2"
fi
if [[ "${break_checks}" != "2" ]]; then
  echo "Pause-Checks fehlen nach dem Apply." >&2
  exit 1
fi

record_break_history() {
  printf '%s\n' "insert into supabase_migrations.schema_migrations (version, name, statements) values ('${BREAK_VERSION}', 'staff_display_break_notifications', array[]::text[]) on conflict (version) do nothing;" \
    | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
      "host=127.0.0.1 port=${LIVE_TUNNEL_LOCAL_PORT} user=postgres dbname=postgres sslmode=disable" \
      -v ON_ERROR_STOP=1 -q
}

break_history="$(tunnel_tac "${BREAK_HISTORY_SQL}")"
echo "History ${BREAK_VERSION} für postgres sichtbar: ${break_history}"
if [[ "${break_history}" == "0" ]]; then
  echo "History-Eintrag setzen (on conflict do nothing) …"
  set +e
  record_break_history
  insert_status=$?
  set -e
  break_history="$(tunnel_tac "${BREAK_HISTORY_SQL}")"
  echo "History nach Insert: ${break_history} (insert_status=${insert_status})"
fi
if [[ "${break_history}" != "1" ]]; then
  echo "History-Zeile bleibt unsichtbar — Tabelle aus sichtbaren Zeilen neu aufbauen …"
  admin_psql <<'SQL'
begin;
set lock_timeout = '15s';
drop table if exists supabase_migrations.schema_migrations_rebuild;
create temp table gwada_mig_grants on commit drop as
select grantee::text as grantee, privilege_type::text as privilege_type
from information_schema.role_table_grants
where table_schema = 'supabase_migrations'
  and table_name = 'schema_migrations';
do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null
     and to_regclass('supabase_migrations.schema_migrations_corrupt') is not null then
    execute 'drop table supabase_migrations.schema_migrations_corrupt';
  end if;
end $$;
create table supabase_migrations.schema_migrations_rebuild
  (like supabase_migrations.schema_migrations including defaults);
insert into supabase_migrations.schema_migrations_rebuild
select * from supabase_migrations.schema_migrations;
alter table supabase_migrations.schema_migrations rename to schema_migrations_corrupt;
alter index if exists supabase_migrations.schema_migrations_pkey
  rename to schema_migrations_pkey_corrupt;
alter table supabase_migrations.schema_migrations_rebuild rename to schema_migrations;
alter table supabase_migrations.schema_migrations add primary key (version);
alter table supabase_migrations.schema_migrations owner to postgres;
grant select, insert, update, delete on supabase_migrations.schema_migrations to postgres;
do $$
declare r record;
begin
  for r in select distinct grantee, privilege_type from gwada_mig_grants loop
    if r.grantee = 'PUBLIC' then
      execute format(
        'grant %s on table supabase_migrations.schema_migrations to public',
        r.privilege_type
      );
    else
      execute format(
        'grant %s on table supabase_migrations.schema_migrations to %I',
        r.privilege_type,
        r.grantee
      );
    end if;
  end loop;
end $$;
drop table supabase_migrations.schema_migrations_corrupt;
commit;
SQL
  record_break_history
  break_history="$(tunnel_tac "${BREAK_HISTORY_SQL}")"
  echo "History nach Rebuild: ${break_history}"
fi
if [[ "${break_history}" != "1" ]]; then
  echo "History ${BREAK_VERSION} ist für den CLI-User nicht sichtbar." >&2
  exit 1
fi
fi

break_owner="$(admin_tac "select pg_get_userbyid(c.relowner) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'supabase_migrations' and c.relname = 'schema_migrations'")"
echo "schema_migrations owner: ${break_owner}"
if [[ -n "${break_owner}" && "${break_owner}" != "postgres" ]]; then
  echo "Owner auf postgres setzen, damit spätere Migrationen die History-Tabelle ändern dürfen."
  printf '%s\n' "alter table supabase_migrations.schema_migrations owner to postgres;" | admin_psql
  break_owner="$(admin_tac "select pg_get_userbyid(c.relowner) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'supabase_migrations' and c.relname = 'schema_migrations'")"
  echo "schema_migrations owner jetzt: ${break_owner}"
fi
if [[ "${break_owner}" != "postgres" ]]; then
  echo "schema_migrations gehört nicht postgres." >&2
  exit 1
fi

SUPABASE_CMD="supabase"
if ! command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD="npx supabase"
fi

repair_migration_applied() {
  local version="$1"
  if ${SUPABASE_CMD} migration list --db-url "${SUPABASE_DB_URL}" 2>/dev/null \
    | grep -E "${version}.*Applied"; then
    return 0
  fi
  echo "Repair ${version} → applied (Schema bereits auf Live)"
  ${SUPABASE_CMD} migration repair --status applied --db-url "${SUPABASE_DB_URL}" "${version}"
}

echo ""
echo "=== Live-DB: Migration-History (Drift-Reparatur) ==="
# Live hat oft Schema unter anderen Versions-IDs; History nachziehen bis 20260626100000.
LIVE_SCHEMA_DRIFT_VERSIONS=(
  20260613170000
  20260619120500
  20260620170000
  20260620175000
  20260621150100
  20260624290000
  20260624300000
)
for version in "${LIVE_SCHEMA_DRIFT_VERSIONS[@]}"; do
  repair_migration_applied "${version}" || true
done

echo ""
echo "=== Live-DB: Migrationen anwenden (nur Schema) ==="
bash scripts/db-push-live.sh --yes --include-all "$@"

echo ""
echo "=== Live-DB: Tabellen prüfen + PostgREST Schema-Cache ==="
# Nach CREATE TABLE kennt PostgREST die Relation erst nach reload — sonst
# „Could not find the table … in the schema cache“ (Assistent-Chat u. a.).
verify_and_reload="$(
  PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    "host=127.0.0.1 port=${LIVE_TUNNEL_LOCAL_PORT} user=postgres dbname=postgres sslmode=disable" \
    -v ON_ERROR_STOP=1 -tAc "
select
  (to_regclass('public.assistant_chat_threads') is not null)::text
  || ' '
  || (to_regclass('public.assistant_chat_messages') is not null)::text;
NOTIFY pgrst, 'reload schema';
select 'reloaded';
"
)"
echo "assistant_chat_threads/messages exist: ${verify_and_reload}"
# Zusätzlich Rest-Container anstupsen (self-hosted Supabase), falls NOTIFY allein nicht reicht.
gwada_ssh_cmd "${LIVE_SSH_USER}@${LIVE_VPS_HOST}" bash -s -- "${DB_CONTAINER}" <<'REMOTE' || true
set -euo pipefail
db="$1"
workdir="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "${db}" 2>/dev/null || true)"
workdir="${workdir//$'\r'/}"
if [[ -z "${workdir}" || ! -d "${workdir}" ]]; then
  echo "Compose-Workdir unbekannt — nur NOTIFY genutzt."
  exit 0
fi
cd "${workdir}"
for svc in rest postgrest supabase-rest; do
  if docker compose ps --services 2>/dev/null | grep -qx "${svc}"; then
    docker compose restart "${svc}" && echo "restarted ${svc}" && exit 0
  fi
done
# Fallback: Container-Name
rest_c="$(docker ps --format '{{.Names}}' | grep -E 'rest|postgrest' | head -1 || true)"
if [[ -n "${rest_c}" ]]; then
  docker restart "${rest_c}" && echo "restarted ${rest_c}"
fi
REMOTE

echo ""
echo "Live-DB-Migrationen angewendet."
