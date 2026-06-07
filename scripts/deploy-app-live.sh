#!/usr/bin/env bash
# Mac/CI: SSH auf VPS → vps-deploy-live-app.sh (baut + tauscht Container + Verifikation).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
DRY_RUN=0
COMMIT=""

for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=1 ;;
    *) COMMIT="${arg}" ;;
  esac
done

if [[ -z "${COMMIT}" ]]; then
  COMMIT="$(git -C "${ROOT}" rev-parse HEAD 2>/dev/null || echo "")"
fi

echo "→ Deploy App live (${SSH_USER}@${VPS}, commit=${COMMIT:-latest})"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[dry-run] Würde scripts/vps-deploy-live-app.sh auf VPS ausführen (commit=${COMMIT})."
  exit 0
fi

if ! gwada_ssh "${SSH_USER}@${VPS}" true; then
  echo "" >&2
  echo "SSH fehlgeschlagen. Einmalig:" >&2
  echo "  ssh-copy-id -i ~/.ssh/id_ed25519.pub ${SSH_USER}@${VPS}" >&2
  echo "  ssh-add --apple-use-keychain ~/.ssh/id_ed25519" >&2
  exit 1
fi

REMOTE_PREFIX=""
if [[ -n "${CHANGELOG_SYNC_SECRET:-}" ]]; then
  REMOTE_PREFIX="CHANGELOG_SYNC_SECRET=$(printf '%q' "${CHANGELOG_SYNC_SECRET}") "
fi

gwada_ssh "${SSH_USER}@${VPS}" "${REMOTE_PREFIX}bash -s -- '${COMMIT}'" \
  < "${ROOT}/scripts/vps-deploy-live-app.sh"
