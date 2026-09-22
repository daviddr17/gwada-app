#!/usr/bin/env bash
# Live-Daten (Truncate/Restore lokal → Live) nur mit expliziter Bestätigung.
# source aus live-sync-data.sh / live-deploy.sh --with-data
if [[ -n "${GWADA_CONFIRM_LIVE_DATA:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi

echo "" >&2
echo "⛔ Live-Daten-Sync blockiert." >&2
echo "" >&2
echo "Das würde Live-Inhalte mit lokalen (oft älteren) Daten überschreiben." >&2
echo "Ohne deinen expliziten Befehl passiert das nicht." >&2
echo "" >&2
echo "Nur wenn du das ausdrücklich willst:" >&2
echo "  GWADA_CONFIRM_LIVE_DATA=1 pnpm sync:live:data" >&2
echo "  GWADA_CONFIRM_LIVE_DATA=1 pnpm sync:live:data:all" >&2
echo "  GWADA_CONFIRM_LIVE_DATA=1 pnpm deploy:live:full" >&2
echo "" >&2
echo "Normales Live-Deploy (Schema + App) braucht dieses Flag nicht." >&2
echo "" >&2
exit 1
