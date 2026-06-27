#!/usr/bin/env bash
# Cursor sessionStart: Dev-Server automatisch im Hintergrund.
cat >/dev/null
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
bash "${ROOT}/scripts/dev-server-bg.sh" >>"${TMPDIR:-/tmp}/gwada-dev-hook.log" 2>&1 &
exit 0
