#!/usr/bin/env bash
# Mac/CI: Image auf GHCR (optional) → SSH auf VPS → Pull + Container-Tausch.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"
# shellcheck source=scripts/live-app-image.sh
source "${ROOT}/scripts/live-app-image.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
DRY_RUN=0
COMMIT=""
DEPLOY_SCRIPTS=(
  vps-deploy-live-app.sh
  vps-ensure-coolify-traefik-fqdn.sh
  ensure-coolify-compose-runtime-env.sh
)

for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=1 ;;
    --build-push)
      BUILD_PUSH=1
      ;;
    *) COMMIT="${arg}" ;;
  esac
done

if [[ -z "${COMMIT}" ]]; then
  COMMIT="$(git -C "${ROOT}" rev-parse HEAD 2>/dev/null || echo "")"
fi

SHA="$(git -C "${ROOT}" rev-parse --short "${COMMIT}" 2>/dev/null || echo "${GWADA_DEPLOY_SHA:-}")"
if [[ -z "${GWADA_DEPLOY_IMAGE:-}" ]]; then
  if [[ "${BUILD_PUSH:-0}" == "1" || "${GWADA_DEPLOY_BUILD_PUSH:-}" == "1" ]]; then
    echo "→ Baue und pushe Live-Image …"
    GWADA_DEPLOY_IMAGE="$(bash "${ROOT}/scripts/build-push-live-app-image.sh" "${COMMIT}")"
  elif [[ -n "${SHA}" ]]; then
    GWADA_DEPLOY_IMAGE="$(live_app_image_for_sha "${SHA}")"
    echo "→ Deploy vorgebautes Image ${GWADA_DEPLOY_IMAGE} (ohne lokalen Build)"
  fi
fi

export GWADA_DEPLOY_IMAGE
export GWADA_DEPLOY_SHA="${GWADA_DEPLOY_SHA:-${SHA}}"

echo "→ Deploy App live (${SSH_USER}@${VPS}, image=${GWADA_DEPLOY_IMAGE:-?}, sha=${GWADA_DEPLOY_SHA:-?})"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "[dry-run] Würde ${GWADA_DEPLOY_IMAGE} auf VPS pullen und Container tauschen."
  exit 0
fi

if [[ -z "${GWADA_DEPLOY_IMAGE:-}" ]]; then
  echo "GWADA_DEPLOY_IMAGE fehlt. Nutze GitHub Action deploy-live-app.yml oder:" >&2
  echo "  GWADA_DEPLOY_BUILD_PUSH=1 npm run deploy:app:live" >&2
  exit 1
fi

if ! gwada_ssh "${SSH_USER}@${VPS}" true; then
  echo "" >&2
  echo "SSH fehlgeschlagen. Einmalig:" >&2
  echo "  ssh-copy-id -i ~/.ssh/id_ed25519.pub ${SSH_USER}@${VPS}" >&2
  exit 1
fi

REMOTE_SCRIPTS="/tmp/gwada-deploy-scripts-$$"
gwada_ssh "${SSH_USER}@${VPS}" "rm -rf '${REMOTE_SCRIPTS}' && mkdir -p '${REMOTE_SCRIPTS}'"
for script_name in "${DEPLOY_SCRIPTS[@]}"; do
  gwada_ssh "${SSH_USER}@${VPS}" "cat > '${REMOTE_SCRIPTS}/${script_name}'" \
    < "${ROOT}/scripts/${script_name}"
done

REMOTE_ENV=(
  "GWADA_DEPLOY_SCRIPTS_DIR=${REMOTE_SCRIPTS}"
  "GWADA_DEPLOY_IMAGE=$(printf '%q' "${GWADA_DEPLOY_IMAGE}")"
  "GWADA_DEPLOY_SHA=$(printf '%q' "${GWADA_DEPLOY_SHA}")"
)
if [[ -n "${CHANGELOG_SYNC_SECRET:-}" ]]; then
  REMOTE_ENV+=("CHANGELOG_SYNC_SECRET=$(printf '%q' "${CHANGELOG_SYNC_SECRET}")")
fi
if [[ -n "${GITHUB_DEPLOY_TOKEN:-}" ]]; then
  REMOTE_ENV+=("GITHUB_DEPLOY_TOKEN=$(printf '%q' "${GITHUB_DEPLOY_TOKEN}")")
  REMOTE_ENV+=("GHCR_PULL_TOKEN=$(printf '%q' "${GITHUB_DEPLOY_TOKEN}")")
fi
if [[ -n "${GHCR_PULL_TOKEN:-}" ]]; then
  REMOTE_ENV+=("GHCR_PULL_TOKEN=$(printf '%q' "${GHCR_PULL_TOKEN}")")
fi
if [[ -n "${CRON_SECRET:-}" ]]; then
  REMOTE_ENV+=("CRON_SECRET=$(printf '%q' "${CRON_SECRET}")")
fi
if [[ "${GWADA_DEPLOY_FORCE_UNLOCK:-}" == "1" ]]; then
  REMOTE_ENV+=("GWADA_DEPLOY_FORCE_UNLOCK=1")
fi

REMOTE_CMD="$(printf '%s ' "${REMOTE_ENV[@]}")bash '${REMOTE_SCRIPTS}/vps-deploy-live-app.sh'"

DEPLOY_LOG="${GWADA_DEPLOY_LOG:-/tmp/gwada-deploy-live-app.log}"

if [[ -n "${GWADA_SSH_BATCH:-}" ]]; then
  DEPLOY_MARKER="gwada-deploy-$(date +%s)-$$"
  gwada_ssh "${SSH_USER}@${VPS}" \
    "echo '=== ${DEPLOY_MARKER} START image=${GWADA_DEPLOY_IMAGE} ===' >> '${DEPLOY_LOG}'"
  gwada_ssh "${SSH_USER}@${VPS}" \
    "${REMOTE_CMD} >> '${DEPLOY_LOG}' 2>&1 & disown; echo deploy_started"

  echo "→ Deploy auf VPS gestartet (${DEPLOY_MARKER}), warte auf Abschluss …"
  DEPLOY_LOCK="/tmp/gwada-deploy-live-app.lock"
  POLL_MAX=40
  for (( poll = 0; poll < POLL_MAX; poll++ )); do
    if gwada_ssh "${SSH_USER}@${VPS}" \
      "awk '/=== ${DEPLOY_MARKER} START/,0' '${DEPLOY_LOG}' | grep -q '=== DEPLOY_OK'"; then
      gwada_ssh "${SSH_USER}@${VPS}" \
        "awk '/=== ${DEPLOY_MARKER} START/,0' '${DEPLOY_LOG}' | tail -30"
      gwada_ssh "${SSH_USER}@${VPS}" "rm -rf '${REMOTE_SCRIPTS}'" || true
      exit 0
    fi
    if ! gwada_ssh "${SSH_USER}@${VPS}" \
      "test -f '${DEPLOY_LOCK}' && kill -0 \"\$(cat '${DEPLOY_LOCK}')\" 2>/dev/null"; then
      if gwada_ssh "${SSH_USER}@${VPS}" \
        "awk '/=== ${DEPLOY_MARKER} START/,0' '${DEPLOY_LOG}' | grep -q '=== DEPLOY_OK'"; then
        gwada_ssh "${SSH_USER}@${VPS}" \
          "awk '/=== ${DEPLOY_MARKER} START/,0' '${DEPLOY_LOG}' | tail -30"
        gwada_ssh "${SSH_USER}@${VPS}" "rm -rf '${REMOTE_SCRIPTS}'" || true
        exit 0
      fi
      echo "Deploy auf VPS beendet ohne DEPLOY_OK (${DEPLOY_MARKER}):" >&2
      gwada_ssh "${SSH_USER}@${VPS}" \
        "awk '/=== ${DEPLOY_MARKER} START/,0' '${DEPLOY_LOG}' | tail -80" >&2 || true
      gwada_ssh "${SSH_USER}@${VPS}" "rm -rf '${REMOTE_SCRIPTS}'" || true
      exit 1
    fi
    sleep 15
  done
  echo "Deploy-Timeout — Log auf VPS: ${DEPLOY_LOG}" >&2
  exit 1
fi

gwada_ssh "${SSH_USER}@${VPS}" "${REMOTE_CMD}"
gwada_ssh "${SSH_USER}@${VPS}" "rm -rf '${REMOTE_SCRIPTS}'" || true
