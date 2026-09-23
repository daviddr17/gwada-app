#!/bin/bash
# Compacts Cursor state.vscdb by removing regenerable agent/chat cache rows.
# Keeps the current gwada Meta-review chat bubbles.
# IMPORTANT: Quit Cursor completely before the REPLACE step at the end.
set -euo pipefail
DB="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
COMPACT="$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb.compact"
KEEP="${1:-ef85e2e6-d6f2-41fd-bca0-3a00a1bd8ae7}"

echo "DB: $DB"
ls -lh "$DB"
echo "Deleting agentKv / checkpoints / old bubbles (keep $KEEP)…"
sqlite3 "$DB" "PRAGMA busy_timeout=120000;
BEGIN IMMEDIATE;
DELETE FROM cursorDiskKV WHERE key LIKE 'agentKv:%';
DELETE FROM cursorDiskKV WHERE key LIKE 'checkpointId:%' OR key LIKE 'checkpoint:%';
DELETE FROM cursorDiskKV WHERE key LIKE 'bubbleId:%' AND key NOT LIKE 'bubbleId:${KEEP}:%';
COMMIT;
SELECT 'remaining_mb', ROUND(SUM(length(value))/1024.0/1024.0,1) FROM cursorDiskKV;"

echo "VACUUM INTO compact file…"
rm -f "$COMPACT"
sqlite3 "$DB" "PRAGMA busy_timeout=120000; VACUUM INTO '$COMPACT';"
ls -lh "$DB" "$COMPACT"

if pgrep -x Cursor >/dev/null 2>&1; then
  echo ""
  echo "Cursor is still running. Quit Cursor fully, then run:"
  echo "  bash $0 --replace"
  echo "Or: mv the .compact over state.vscdb after quit."
  exit 0
fi

if [ "${1:-}" = "--replace" ] || [ "${2:-}" = "--replace" ]; then
  ts=$(date +%Y%m%d-%H%M%S)
  mv "$DB" "$DB.bak-$ts"
  mv "$COMPACT" "$DB"
  rm -f "$DB-wal" "$DB-shm" 2>/dev/null || true
  echo "Replaced. Backup: $DB.bak-$ts"
  ls -lh "$DB"
fi
