#!/usr/bin/env bash
# Contabo VPS: native Auto Backup einschalten ODER tägliche Snapshots + Prune.
#
# Contabo hat KEIN Snapshot-Schedule in der API. Native täglich =
# Paid Add-on „Auto Backup“ via POST …/instances/{id}/upgrade {"backup":{}}.
# Fallback: Snapshot create + prune (GitHub Actions cron).
#
# Secrets (nie committen):
#   CONTABO_CLIENT_ID CONTABO_CLIENT_SECRET CONTABO_API_USER CONTABO_API_PASSWORD
# Optional:
#   CONTABO_INSTANCE_ID  — sonst Lookup per CONTABO_VPS_IP / LIVE_VPS_HOST
#   CONTABO_VPS_IP       — default 95.111.229.250
#   CONTABO_SNAPSHOT_RETAIN — default 3 (Plan-Limit beachten: oft 1–3)
#   CONTABO_SNAPSHOT_PREFIX — default gwada-daily
#
# Usage:
#   bash scripts/contabo-daily-snapshots.sh status
#   bash scripts/contabo-daily-snapshots.sh enable-auto-backup   # kostenpflichtig
#   bash scripts/contabo-daily-snapshots.sh snapshot            # create + prune
set -euo pipefail

MODE="${1:-snapshot}"
AUTH_URL="https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token"
API_BASE="https://api.contabo.com/v1"
VPS_IP="${CONTABO_VPS_IP:-${LIVE_VPS_HOST:-95.111.229.250}}"
RETAIN="${CONTABO_SNAPSHOT_RETAIN:-3}"
PREFIX="${CONTABO_SNAPSHOT_PREFIX:-gwada-daily}"

need() {
  local name="$1" val="${2:-}"
  if [[ -z "${val}" ]]; then
    echo "::error::Fehlt: ${name} (Contabo Customer Control Panel → API credentials)." >&2
    exit 1
  fi
}

need CONTABO_CLIENT_ID "${CONTABO_CLIENT_ID:-}"
need CONTABO_CLIENT_SECRET "${CONTABO_CLIENT_SECRET:-}"
need CONTABO_API_USER "${CONTABO_API_USER:-}"
need CONTABO_API_PASSWORD "${CONTABO_API_PASSWORD:-}"

if ! [[ "${RETAIN}" =~ ^[1-9][0-9]*$ ]]; then
  echo "::error::CONTABO_SNAPSHOT_RETAIN muss eine positive Ganzzahl sein (ist: ${RETAIN})." >&2
  exit 1
fi

uuid() {
  if command -v uuidgen >/dev/null 2>&1; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    python3 -c 'import uuid; print(uuid.uuid4())'
  fi
}

req_id() { uuid; }

get_token() {
  local resp
  resp="$(curl -sS -X POST "${AUTH_URL}" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d "client_id=${CONTABO_CLIENT_ID}" \
    -d "client_secret=${CONTABO_CLIENT_SECRET}" \
    --data-urlencode "username=${CONTABO_API_USER}" \
    --data-urlencode "password=${CONTABO_API_PASSWORD}" \
    -d 'grant_type=password')"
  ACCESS_TOKEN="$(printf '%s' "${resp}" | jq -r '.access_token // empty')"
  if [[ -z "${ACCESS_TOKEN}" || "${ACCESS_TOKEN}" == "null" ]]; then
    echo "::error::Contabo Auth fehlgeschlagen (Client-ID/Secret/User/Password prüfen)." >&2
    # Keine Token-/Passwort-Werte loggen
    printf '%s' "${resp}" | jq -c '{error:(.error//null),error_description:(.error_description//null)}' 2>/dev/null \
      || echo "(Auth-Response ohne Token)"
    exit 1
  fi
}

api() {
  local method="$1" path="$2"
  shift 2
  local rid tid
  rid="$(req_id)"
  tid="$(req_id)"
  curl -sS -X "${method}" "${API_BASE}${path}" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "x-request-id: ${rid}" \
    -H "x-trace-id: ${tid}" \
    "$@"
}

resolve_instance_id() {
  if [[ -n "${CONTABO_INSTANCE_ID:-}" ]]; then
    INSTANCE_ID="${CONTABO_INSTANCE_ID}"
    echo "Instance-ID aus Env: ${INSTANCE_ID}"
    return
  fi
  local raw match
  raw="$(api GET "/compute/instances?search=$(printf '%s' "${VPS_IP}" | jq -sRr @uri)&size=50")"
  match="$(printf '%s' "${raw}" | jq -r --arg ip "${VPS_IP}" '
    [.data[]? | select(
      (.ipConfig.v4.ip // "") == $ip
      or ((.additionalIps // []) | map(.v4.ip // "") | index($ip) != null)
    ) | .instanceId] | first // empty
  ')"
  if [[ -z "${match}" ]]; then
    # Fallback: erste Instanz auflisten (Hilfe bei Fehlersuche, ohne Secrets)
    echo "::error::Keine Contabo-Instanz mit IP ${VPS_IP} gefunden. CONTABO_INSTANCE_ID setzen." >&2
    printf '%s' "${raw}" | jq -c '[.data[]? | {instanceId,displayName,name,ip:(.ipConfig.v4.ip//null)}]' 2>/dev/null || true
    exit 1
  fi
  INSTANCE_ID="${match}"
  echo "Instance-ID für ${VPS_IP}: ${INSTANCE_ID}"
}

instance_summary() {
  local raw
  raw="$(api GET "/compute/instances/${INSTANCE_ID}")"
  printf '%s' "${raw}" | jq -c '
    .data[0] | {
      instanceId,
      displayName,
      name,
      status,
      productId,
      productName,
      ip:(.ipConfig.v4.ip // null),
      addOns
    }
  '
  local prods
  prods="$(api GET "/compute/instances/${INSTANCE_ID}/products" || true)"
  BACKUP_ON_PRODUCT="$(printf '%s' "${prods}" | jq -r '
    [.data[]? | select(.current == true) | .hasBackupAddon] | first // false
  ' 2>/dev/null || echo false)"
  echo "hasBackupAddon(product)=${BACKUP_ON_PRODUCT}"
}

enable_auto_backup() {
  if [[ "${GWADA_CONFIRM_CONTABO_BACKUP:-}" != "1" ]]; then
    echo "::error::Auto Backup ist kostenpflichtig. Zum Einschalten: GWADA_CONFIRM_CONTABO_BACKUP=1 setzen." >&2
    exit 1
  fi
  instance_summary
  if [[ "${BACKUP_ON_PRODUCT}" == "true" ]]; then
    echo "Auto Backup Add-on ist bereits aktiv — nichts zu tun."
    return 0
  fi
  echo "Schalte Contabo Auto Backup Add-on ein (täglich, Retention ~10 Tage, off-server)…"
  local resp
  resp="$(api POST "/compute/instances/${INSTANCE_ID}/upgrade" -d '{"backup":{}}')"
  printf '%s' "${resp}" | jq -c '{instanceId:(.data[0].instanceId//null),createdDate:(.data[0].createdDate//null),_links}' 2>/dev/null \
    || printf '%s\n' "${resp}"
  echo "Upgrade-Request gesendet. Contabo startet den ersten Backup im Standard-Fenster (meist 09–17 CET)."
}

list_managed_snapshots() {
  api GET "/compute/instances/${INSTANCE_ID}/snapshots?size=100&orderBy=createdDate:asc" \
    | jq -c --arg p "${PREFIX}" '
      [.data[]? | select((.name // "") | startswith($p))
        | {snapshotId, name, createdDate, autoDeleteDate}]
    '
}

prune_and_create_snapshot() {
  local snaps count to_delete name today resp
  today="$(date -u +%Y%m%d)"
  name="${PREFIX}-${today}"

  snaps="$(list_managed_snapshots)"
  count="$(printf '%s' "${snaps}" | jq 'length')"
  echo "Bestehende managed Snapshots (${PREFIX}*): ${count} (Retain=${RETAIN})"
  printf '%s' "${snaps}" | jq -c '.[]' || true

  # Vor Create: Platz schaffen (Contabo Plan-Limit oft 1–3 Snapshots gesamt).
  # Lösche älteste managed Snapshots, bis Retain-1 frei (Platz für neuen).
  local keep_before=$((RETAIN - 1))
  if ((keep_before < 0)); then keep_before=0; fi
  to_delete="$(printf '%s' "${snaps}" | jq -c --argjson keep "${keep_before}" '
    if length <= $keep then [] else .[0:(length - $keep)] end
  ')"
  local del_id
  while IFS= read -r del_id; do
    [[ -z "${del_id}" || "${del_id}" == "null" ]] && continue
    echo "Lösche alten Snapshot: ${del_id}"
    api DELETE "/compute/instances/${INSTANCE_ID}/snapshots/${del_id}" -d '{}' >/dev/null || true
  done < <(printf '%s' "${to_delete}" | jq -r '.[].snapshotId')

  # Gleicher Tag schon vorhanden? Dann kein zweites Create.
  local existing_today
  existing_today="$(list_managed_snapshots | jq -r --arg n "${name}" '
    [.[] | select(.name == $n) | .snapshotId] | first // empty
  ')"
  if [[ -n "${existing_today}" ]]; then
    echo "Snapshot für heute existiert bereits: ${name} (${existing_today})"
    return 0
  fi

  echo "Erstelle Snapshot: ${name}"
  resp="$(api POST "/compute/instances/${INSTANCE_ID}/snapshots" \
    -d "$(jq -nc --arg n "${name}" '{name:$n, description:"Gwada daily snapshot (CI)"}')")"
  printf '%s' "${resp}" | jq -c '
    .data[0] | {snapshotId, name, createdDate, autoDeleteDate, instanceId}
  ' 2>/dev/null || printf '%s\n' "${resp}"

  # Nach Create: auf Retain trimmen
  snaps="$(list_managed_snapshots)"
  to_delete="$(printf '%s' "${snaps}" | jq -c --argjson keep "${RETAIN}" '
    if length <= $keep then [] else .[0:(length - $keep)] end
  ')"
  while IFS= read -r del_id; do
    [[ -z "${del_id}" || "${del_id}" == "null" ]] && continue
    echo "Prune nach Create: ${del_id}"
    api DELETE "/compute/instances/${INSTANCE_ID}/snapshots/${del_id}" -d '{}' >/dev/null || true
  done < <(printf '%s' "${to_delete}" | jq -r '.[].snapshotId')

  echo "Fertig. Aktuelle managed Snapshots:"
  list_managed_snapshots | jq -c '.[]' || true
}

# --- main ---
command -v jq >/dev/null 2>&1 || { echo "::error::jq fehlt"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "::error::curl fehlt"; exit 1; }

get_token
resolve_instance_id

case "${MODE}" in
  status)
    instance_summary
    echo "managed snapshots:"
    list_managed_snapshots | jq .
    ;;
  enable-auto-backup)
    enable_auto_backup
    ;;
  snapshot)
    prune_and_create_snapshot
    ;;
  *)
    echo "Usage: $0 status|enable-auto-backup|snapshot" >&2
    exit 2
    ;;
esac
