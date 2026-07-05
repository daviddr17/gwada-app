#!/usr/bin/env bash
# Optional: new.gwada.app → 301 https://gwada.app (Traefik Middleware auf dem VPS).
set -euo pipefail

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
SOURCE_HOST="${GWADA_REDIRECT_FROM:-new.gwada.app}"
TARGET_ORIGIN="${GWADA_REDIRECT_TO:-https://gwada.app}"

# shellcheck source=scripts/gwada-ssh-lib.sh
source "$(dirname "$0")/gwada-ssh-lib.sh"

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${SOURCE_HOST}" "${TARGET_ORIGIN}" <<'REMOTE'
set -euo pipefail
from="$1"
to="$2"

dynamic_dir="/data/coolify/proxy/dynamic"
mkdir -p "${dynamic_dir}"

cat > "${dynamic_dir}/gwada-new-redirect.yaml" <<YAML
http:
  middlewares:
    gwada-new-to-production:
      redirectRegex:
        regex: "^https://${from}/(.*)"
        replacement: "${to}/\${1}"
        permanent: true
  routers:
    gwada-new-redirect:
      rule: "Host(\`${from}\`)"
      entryPoints:
        - https
      middlewares:
        - gwada-new-to-production
      service: noop@internal
      tls:
        certResolver: letsencrypt
YAML

echo "  ✓ Traefik dynamic config: ${dynamic_dir}/gwada-new-redirect.yaml"
echo "  DNS ${from} muss weiter auf den VPS zeigen (Let's Encrypt)."
REMOTE

echo "✓ Redirect ${SOURCE_HOST} → ${TARGET_ORIGIN} konfiguriert."
