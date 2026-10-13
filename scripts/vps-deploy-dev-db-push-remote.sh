#!/usr/bin/env bash
# Auf dem VPS: supabase db push via docker compose exec (localhost im DB-Container).
set -euo pipefail

compose_dir="$1"
mig_root="$2"
cli_dir="${3:-/tmp/supabase-cli}"
cli_version="${SUPABASE_CLI_VERSION:-2.105.0}"

cd "${compose_dir}"
export COMPOSE_PROJECT_NAME=gwada-dev

for i in $(seq 1 90); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker compose exec -T db pg_isready -U postgres

PW="$(docker compose exec -T db printenv POSTGRES_PASSWORD | tr -d '\r\n')"
[[ -n "${PW}" ]] || PW="$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//' | tr -d '\r\n')"
ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${PW}")"
DB_CID="$(docker compose ps -q db)"
[[ -n "${DB_CID}" ]] || { echo "FEHLER: DB-Container fehlt." >&2; exit 1; }

docker exec "${DB_CID}" rm -rf /tmp/supabase-cli /tmp/migrations
docker cp "${mig_root}/." "${DB_CID}:/tmp/migrations/"

if [[ -d "${cli_dir}" ]] && [[ -x "${cli_dir}/supabase-go" ]]; then
  docker cp "${cli_dir}/." "${DB_CID}:/tmp/supabase-cli/"
  docker exec "${DB_CID}" chmod +x /tmp/supabase-cli/supabase /tmp/supabase-cli/supabase-go 2>/dev/null || true
else
  echo "→ Supabase CLI v${cli_version} im DB-Container laden …"
  docker exec "${DB_CID}" bash -c "
    set -euo pipefail
    mkdir -p /tmp/supabase-cli
    curl -fsSL 'https://github.com/supabase/cli/releases/download/v${cli_version}/supabase_${cli_version}_linux_amd64.tar.gz' \
      | tar -xzf - -C /tmp/supabase-cli
    chmod +x /tmp/supabase-cli/supabase /tmp/supabase-cli/supabase-go
  "
fi

DB_PORT="5435"
if ! docker compose exec -T -e PGPASSWORD="${PW}" db \
  psql -U supabase_admin -h localhost -p "${DB_PORT}" -d postgres -tAc 'select 1' >/dev/null 2>&1; then
  DB_PORT="5432"
fi

DB_URL="postgresql://supabase_admin:${ENC_PW}@127.0.0.1:${DB_PORT}/postgres?sslmode=disable"
SUPABASE_BIN="/tmp/supabase-cli/supabase-go"
if ! docker exec "${DB_CID}" test -x "${SUPABASE_BIN}"; then
  SUPABASE_BIN="/tmp/supabase-cli/supabase"
fi

# Fehlende Relation-Dateien (SQLSTATE 58P01) vor History-Lesezugriff reparieren.
if [[ -f /tmp/vps-dev-db-repair-missing-files.sh ]]; then
  bash /tmp/vps-dev-db-repair-missing-files.sh "${compose_dir}" "${DB_PORT}" "${PW}"
elif [[ -f "${mig_root}/../scripts/vps-dev-db-repair-missing-files.sh" ]]; then
  bash "${mig_root}/../scripts/vps-dev-db-repair-missing-files.sh" "${compose_dir}" "${DB_PORT}" "${PW}"
fi

echo "→ Dev: Remote-Migrationen ohne lokale Datei als reverted markieren …"
# Ohne ORDER BY (kaputter Index sonst 58P01); Sequenz-Scan reicht.
mapfile -t REMOTE_VERS < <(
  docker compose exec -T -e PGPASSWORD="${PW}" db \
    psql -U supabase_admin -h localhost -p "${DB_PORT}" -d postgres -tAc \
    "select version from supabase_migrations.schema_migrations;" \
    2>/dev/null \
    | tr -d '\r' || true
)

# Wenn History leer/neu: alle lokalen Migrationen außer der neuesten als applied markieren,
# damit db push nur wirklich ausstehende Dateien anwendet (Dev-Schema ist i. d. R. schon da).
remote_count=0
for ver in "${REMOTE_VERS[@]+"${REMOTE_VERS[@]}"}"; do
  ver="${ver//[[:space:]]/}"
  [[ -n "${ver}" ]] && remote_count=$((remote_count + 1))
done

shopt -s nullglob
local_migs=("${mig_root}/supabase/migrations/"*.sql)
if (( remote_count == 0 && ${#local_migs[@]} > 0 )); then
  echo "  schema_migrations leer — seed applied für alle außer letzter Migration …"
  # Sortiert nach Dateiname (= Timestamp-Präfix)
  IFS=$'\n' sorted_migs=($(printf '%s\n' "${local_migs[@]}" | sort))
  unset IFS
  seed_vers=()
  for ((i = 0; i < ${#sorted_migs[@]} - 1; i++)); do
    base="$(basename "${sorted_migs[$i]}")"
    ver="${base%%_*}"
    [[ -n "${ver}" ]] && seed_vers+=("${ver}")
  done
  if ((${#seed_vers[@]} > 0)); then
    docker compose exec -T -w /tmp/migrations db \
      env PGSSLMODE=disable \
      "${SUPABASE_BIN}" migration repair --status applied --db-url "${DB_URL}" \
      "${seed_vers[@]}"
  fi
  last_base="$(basename "${sorted_migs[-1]}")"
  echo "  offen für db push: ${last_base}"
else
  repair_args=()
  for ver in "${REMOTE_VERS[@]+"${REMOTE_VERS[@]}"}"; do
    ver="${ver//[[:space:]]/}"
    [[ -z "${ver}" ]] && continue
    matches=("${mig_root}/supabase/migrations/${ver}_"*.sql)
    if ((${#matches[@]} == 0)); then
      repair_args+=("${ver}")
    fi
  done
  if ((${#repair_args[@]} > 0)); then
    echo "  reverted: ${repair_args[*]}"
    docker compose exec -T -w /tmp/migrations db \
      env PGSSLMODE=disable \
      "${SUPABASE_BIN}" migration repair --status reverted --db-url "${DB_URL}" \
      "${repair_args[@]}"
  fi
fi

echo "→ supabase db push (im DB-Container, localhost:${DB_PORT}) …"
set +e
push_out="$(
  docker compose exec -T -w /tmp/migrations db \
    env PGSSLMODE=disable \
    "${SUPABASE_BIN}" db push --db-url "${DB_URL}" --yes --include-all 2>&1
)"
push_rc=$?
set -e
printf '%s\n' "${push_out}"
if (( push_rc != 0 )); then
  if grep -q 'could not open file "base/' <<<"${push_out}" \
    || grep -q 'SQLSTATE 58P01' <<<"${push_out}"; then
    echo "→ db push scheiterte an fehlender Relation-Datei — Repair + Retry …" >&2
    if [[ -f /tmp/vps-dev-db-repair-missing-files.sh ]]; then
      bash /tmp/vps-dev-db-repair-missing-files.sh "${compose_dir}" "${DB_PORT}" "${PW}"
    fi
    # Nach Repair History ggf. neu seedern wenn leer
    left="$(
      docker compose exec -T -e PGPASSWORD="${PW}" db \
        psql -U supabase_admin -h localhost -p "${DB_PORT}" -d postgres -tAc \
        "select count(*) from supabase_migrations.schema_migrations;" \
        | tr -d '[:space:]'
    )"
    if [[ "${left}" == "0" && ${#local_migs[@]} -gt 1 ]]; then
      IFS=$'\n' sorted_migs=($(printf '%s\n' "${local_migs[@]}" | sort))
      unset IFS
      seed_vers=()
      for ((i = 0; i < ${#sorted_migs[@]} - 1; i++)); do
        base="$(basename "${sorted_migs[$i]}")"
        ver="${base%%_*}"
        [[ -n "${ver}" ]] && seed_vers+=("${ver}")
      done
      if ((${#seed_vers[@]} > 0)); then
        docker compose exec -T -w /tmp/migrations db \
          env PGSSLMODE=disable \
          "${SUPABASE_BIN}" migration repair --status applied --db-url "${DB_URL}" \
          "${seed_vers[@]}"
      fi
    fi
    docker compose exec -T -w /tmp/migrations db \
      env PGSSLMODE=disable \
      "${SUPABASE_BIN}" db push --db-url "${DB_URL}" --yes --include-all
  else
    exit "${push_rc}"
  fi
fi
