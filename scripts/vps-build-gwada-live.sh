#!/usr/bin/env bash
# @deprecated — nutze scripts/vps-deploy-live-app.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "${ROOT}/scripts/vps-deploy-live-app.sh" "$@"
