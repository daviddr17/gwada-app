#!/usr/bin/env bash
# Legacy no-op: Repair/Ghost-Logik liegt in vps-deploy-dev-db-push-remote.sh
# (Volume-Reset bei kaputter Dev-DB, dann Push als postgres).
set -euo pipefail
echo "→ vps-dev-db-repair-missing-files: übersprungen (Reset/Push übernimmt Push-Remote)."
exit 0
