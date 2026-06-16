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
if [[ -n "${GITHUB_DEPLOY_TOKEN:-}" ]]; then
  REMOTE_PREFIX="${REMOTE_PREFIX}GITHUB_DEPLOY_TOKEN=$(printf '%q' "${GITHUB_DEPLOY_TOKEN}") "
fi
if [[ -n "${CRON_SECRET:-}" ]]; then
  REMOTE_PREFIX="${REMOTE_PREFIX}CRON_SECRET=$(printf '%q' "${CRON_SECRET}") "
fi
if [[ "${GWADA_DEPLOY_FORCE_UNLOCK:-}" == "1" ]]; then
  REMOTE_PREFIX="${REMOTE_PREFIX}GWADA_DEPLOY_FORCE_UNLOCK=1 "
fi

DEPLOY_LOG="${GWADA_DEPLOY_LOG:-/tmp/gwada-deploy-live-app.log}"
DEPLOY_LOCK="${GWADA_DEPLOY_LOCK:-/tmp/gwada-deploy-live-app.lock}"
REMOTE_SCRIPT="/tmp/gwada-vps-deploy-live-app.sh"

if [[ -n "${GWADA_SSH_BATCH:-}" ]]; then
  # CI: Deploy auf dem VPS entkoppeln — langer Docker-Build darf SSH-Abbruch überleben.
  gwada_ssh "${SSH_USER}@${VPS}" "cat > '${REMOTE_SCRIPT}'" \
    < "${ROOT}/scripts/vps-deploy-live-app.sh"
  gwada_ssh "${SSH_USER}@${VPS}" \
    "${REMOTE_PREFIX}nohup bash '${REMOTE_SCRIPT}' '${COMMIT}' >> '${DEPLOY_LOG}' 2>&1 & disown; echo deploy_started"

  echo "→ Deploy auf VPS gestartet, warte auf Abschluss (Log: ${DEPLOY_LOG}) …"
  POLL_MAX=90
  for (( poll = 0; poll < POLL_MAX; poll++ )); do
    if gwada_ssh "${SSH_USER}@${VPS}" "grep -q '=== DEPLOY_OK' '${DEPLOY_LOG}' 2>/dev/null"; then
      gwada_ssh "${SSH_USER}@${VPS}" "tail -40 '${DEPLOY_LOG}'"
      exit 0
    fi
    if ! gwada_ssh "${SSH_USER}@${VPS}" \
      "test -f '${DEPLOY_LOCK}' && kill -0 \"\$(cat '${DEPLOY_LOCK}')\" 2>/dev/null"; then
      if gwada_ssh "${SSH_USER}@${VPS}" "grep -q '=== DEPLOY_OK' '${DEPLOY_LOG}' 2>/dev/null"; then
        gwada_ssh "${SSH_USER}@${VPS}" "tail -40 '${DEPLOY_LOG}'"
        exit 0
      fi
      echo "Deploy auf VPS beendet ohne DEPLOY_OK:" >&2
      gwada_ssh "${SSH_USER}@${VPS}" "tail -80 '${DEPLOY_LOG}'" >&2 || true
      exit 1
    fi
    gwada_ssh "${SSH_USER}@${VPS}" "tail -5 '${DEPLOY_LOG}' 2>/dev/null" || true
    sleep 30
  done
  echo "Deploy-Timeout nach $((POLL_MAX * 30 / 60)) Minuten — Log auf VPS prüfen: ${DEPLOY_LOG}" >&2
  exit 1
fi

gwada_ssh "${SSH_USER}@${VPS}" "${REMOTE_PREFIX}bash -s -- '${COMMIT}'" \
  < "${ROOT}/scripts/vps-deploy-live-app.sh"
