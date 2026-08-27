#!/usr/bin/env bash
# Call a live cron endpoint with retries. Usage: cron-curl.sh <path> [max-time-seconds]
# Expects CRON_BASE_URL + CRON_SECRET. HTTP 200 = success (timedOut in JSON is OK).
set -euo pipefail

PATH_SUFFIX="${1:?cron path required, e.g. /api/cron/reservation-whatsapp}"
MAX_TIME="${2:-120}"

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET not set — skipped."
  exit 0
fi

BASE="${CRON_BASE_URL:-https://gwada.app}"
URL="${BASE}${PATH_SUFFIX}"

for attempt in 1 2 3; do
  body="$(mktemp)"
  code="$(
    curl -sS -o "$body" -w "%{http_code}" --max-time "${MAX_TIME}" \
      -H "Authorization: Bearer ${CRON_SECRET}" \
      "$URL" || echo "000"
  )"
  if [ "$code" = "200" ]; then
    cat "$body"
    echo
    if command -v jq >/dev/null 2>&1 && jq -e '.timedOut == true' "$body" >/dev/null 2>&1; then
      echo "Run hit budget (timedOut) — remaining work on next schedule."
    fi
    rm -f "$body"
    exit 0
  fi
  echo "Attempt ${attempt} failed (HTTP ${code})"
  if [ -s "$body" ]; then
    head -c 500 "$body"
    echo
  fi
  rm -f "$body"
  if [ "$attempt" -lt 3 ]; then
    sleep $((attempt * 8))
  fi
done

echo "Cron call failed after 3 attempts: ${URL}"
exit 1
