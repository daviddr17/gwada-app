#!/usr/bin/env bash
# Früher Abbruch mit klarer Meldung — keine Secret-Werte loggen.
# Pflicht: LIVE_SSH_KEY, LIVE_VPS_HOST + SSH zum VPS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

missing=()
[[ -n "${LIVE_SSH_KEY:-}" ]] || missing+=(LIVE_SSH_KEY)
[[ -n "${LIVE_VPS_HOST:-}" ]] || missing+=(LIVE_VPS_HOST)

if ((${#missing[@]})); then
  echo "::error::Fehlende GitHub Repository Secrets: ${missing[*]}"
  echo "Ohne diese Secrets kann kein Live-Deploy laufen. Secrets nur im GitHub-Repo setzen — nicht lokal erfinden." >&2
  exit 1
fi

mkdir -p ~/.ssh
printf '%s\n' "${LIVE_SSH_KEY}" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keyscan -H "${LIVE_VPS_HOST}" >> ~/.ssh/known_hosts 2>/dev/null || true
export GWADA_SSH_IDENTITY=~/.ssh/id_ed25519
export GWADA_SSH_BATCH=1
export GWADA_SSH_MAX_ATTEMPTS="${GWADA_SSH_MAX_ATTEMPTS:-3}"

if ! gwada_ssh -o ConnectTimeout=12 "root@${LIVE_VPS_HOST}" true; then
  echo "::error::SSH zum VPS (${LIVE_VPS_HOST}) fehlgeschlagen — LIVE_SSH_KEY prüfen (öffentlicher Key auf dem VPS in authorized_keys)."
  exit 1
fi

echo "Preflight OK: SSH root@${LIVE_VPS_HOST}"

# Optional — nur Presence (yes/no), keine Werte.
report_opt() {
  local name="$1" val="${2:-}"
  if [[ -n "${val}" ]]; then
    echo "optional ${name}: gesetzt"
  else
    echo "optional ${name}: fehlt (ok wenn Fallback greift)"
  fi
}

report_opt LIVE_NEXT_PUBLIC_SUPABASE_ANON_KEY "${LIVE_NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
report_opt GWADA_GITHUB_APP_ID "${GWADA_GITHUB_APP_ID:-${GITHUB_APP_ID:-}}"
report_opt GWADA_GITHUB_APP_INSTALLATION_ID "${GWADA_GITHUB_APP_INSTALLATION_ID:-${GITHUB_APP_INSTALLATION_ID:-}}"
report_opt GWADA_GITHUB_APP_PRIVATE_KEY "${GWADA_GITHUB_APP_PRIVATE_KEY:-${GITHUB_APP_PRIVATE_KEY:-}}"
report_opt GWADA_GITHUB_DEPLOY_TOKEN "${GWADA_GITHUB_DEPLOY_TOKEN:-${GITHUB_DEPLOY_TOKEN:-}}"
report_opt CRON_SECRET "${CRON_SECRET:-}"
