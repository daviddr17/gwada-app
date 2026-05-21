#!/usr/bin/env bash
# Restaurant-Zuordnung für dreyer@techlion.de auf Live (nach Auth-Sync).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Tunnel + psql wie sync-live-data (nur ensure-demo-workspace.sql)
export SYNC_WORKSPACE_ONLY=1
exec bash "${ROOT}/scripts/sync-live-data.sh"
