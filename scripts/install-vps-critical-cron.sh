#!/usr/bin/env bash
# Installiert Host-Crontab auf dem Live-VPS — der Server ist der einzige Scheduler.
# GitHub Actions hat kein schedule mehr, nur manuellen Notfall-Dispatch.
#
# Erwartet: SSH wie sync-cron-secret-live (LIVE_VPS_HOST, GWADA_SSH_*).
# CRON_SECRET wird aus Coolify-App-.env gelesen (bereits synchronisiert).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
BASE_URL="${CRON_BASE_URL:-https://gwada.app}"

if ! gwada_ssh "${SSH_USER}@${VPS}" true; then
  echo "SSH fehlgeschlagen (${SSH_USER}@${VPS})." >&2
  exit 1
fi

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${BASE_URL@Q}" <<'REMOTE'
set -euo pipefail
base_url="$1"
app_id="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
env_file="/data/coolify/applications/${app_id}/.env"
marker_begin="# BEGIN gwada-critical-cron"
marker_end="# END gwada-critical-cron"
wrapper="/usr/local/bin/gwada-cron-curl"
log_dir="/var/log/gwada-cron"

if [[ ! -f "${env_file}" ]]; then
  echo "Coolify .env fehlt: ${env_file}" >&2
  exit 1
fi

secret="$(grep -E '^CRON_SECRET=' "${env_file}" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [[ -z "${secret}" ]]; then
  echo "CRON_SECRET fehlt in ${env_file} — zuerst sync-cron-secret-live." >&2
  exit 1
fi

mkdir -p "${log_dir}"

cat > "${wrapper}" <<'WRAP'
#!/usr/bin/env bash
set -euo pipefail
path="${1:?}"
max_time="${2:-120}"
base="${CRON_BASE_URL:-https://gwada.app}"
secret="${CRON_SECRET:?}"
code="$(curl -sS -o /tmp/gwada-cron-body.$$ -w "%{http_code}" --max-time "${max_time}" \
  -H "Authorization: Bearer ${secret}" \
  "${base}${path}" || echo "000")"
if [[ "${code}" != "200" ]]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) FAIL ${path} HTTP ${code}" >&2
  head -c 400 /tmp/gwada-cron-body.$$ 2>/dev/null || true
  rm -f /tmp/gwada-cron-body.$$
  exit 1
fi
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) OK ${path} $(head -c 200 /tmp/gwada-cron-body.$$)"
rm -f /tmp/gwada-cron-body.$$
WRAP
chmod 755 "${wrapper}"

# Env für Wrapper (root crontab)
env_snippet="CRON_BASE_URL=${base_url} CRON_SECRET=${secret}"

block=$(cat <<EOF
${marker_begin}
# Gwada: einzig gültiger Produktions-Scheduler (UTC)
*/5 * * * * ${env_snippet} ${wrapper} /api/cron/reservation-whatsapp 120 >> ${log_dir}/reservation-whatsapp.log 2>&1
*/5 * * * * ${env_snippet} ${wrapper} /api/cron/reservation-email 120 >> ${log_dir}/reservation-email.log 2>&1
*/2 * * * * ${env_snippet} ${wrapper} /api/cron/notification-deliver 130 >> ${log_dir}/notification-deliver.log 2>&1
*/5 * * * * ${env_snippet} ${wrapper} /api/cron/staff-shift-notifications 120 >> ${log_dir}/staff-shift-notifications.log 2>&1
*/5 * * * * ${env_snippet} ${wrapper} /api/cron/waha-session-recover 180 >> ${log_dir}/waha-session-recover.log 2>&1
*/5 * * * * ${env_snippet} ${wrapper} /api/cron/reservation-whatsapp-slo 60 >> ${log_dir}/reservation-whatsapp-slo.log 2>&1
*/5 * * * * ${env_snippet} ${wrapper} /api/cron/contact-inbox-sync 180 >> ${log_dir}/contact-inbox-sync.log 2>&1
*/5 * * * * ${env_snippet} ${wrapper} /api/cron/newsletter-send 130 >> ${log_dir}/newsletter-send.log 2>&1
*/5 * * * * ${env_snippet} ${wrapper} /api/cron/news-publish 60 >> ${log_dir}/news-publish.log 2>&1
*/10 * * * * ${env_snippet} ${wrapper} /api/cron/news-feed-sync 180 >> ${log_dir}/news-feed-sync.log 2>&1
*/10 * * * * ${env_snippet} ${wrapper} /api/cron/reviews-feed-sync 180 >> ${log_dir}/reviews-feed-sync.log 2>&1
*/10 * * * * ${env_snippet} ${wrapper} /api/cron/accounting-lexoffice-sync 300 >> ${log_dir}/accounting-lexoffice-sync.log 2>&1
0 6 * * * ${env_snippet} ${wrapper} /api/cron/billing-past-due 180 >> ${log_dir}/billing-past-due.log 2>&1
0 7 * * 1 ${env_snippet} ${wrapper} /api/cron/social-suggestions 300 >> ${log_dir}/social-suggestions.log 2>&1
${marker_end}
EOF
)

existing="$(crontab -l 2>/dev/null || true)"
# Alten Block entfernen
cleaned="$(printf '%s\n' "${existing}" | sed "/${marker_begin}/,/${marker_end}/d")"
printf '%s\n%s\n' "${cleaned}" "${block}" | crontab -
echo "✓ VPS crontab installiert (alle Live-Crons, inkl. News-Publish und Billing)"
crontab -l | sed -n "/${marker_begin}/,/${marker_end}/p" | sed 's/CRON_SECRET=[^ ]*/CRON_SECRET=***/g'
REMOTE

echo "✓ Host-Cron auf VPS aktiv"
