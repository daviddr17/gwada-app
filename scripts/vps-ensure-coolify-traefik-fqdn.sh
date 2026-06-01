#!/usr/bin/env bash
# Stellt Traefik-Router für COOLIFY_FQDN (z. B. new.gwada.app) in der Coolify-Compose sicher.
# Ohne https-Router liefert Traefik nur catchall → „no available server“ (503).
set -euo pipefail

COMPOSE_DIR="${1:-${GWADA_COOLIFY_COMPOSE_DIR:-}}"
APP_ID="${2:-${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}}"

if [[ -z "${COMPOSE_DIR}" ]]; then
  COMPOSE_DIR="/data/coolify/applications/${APP_ID}"
fi

COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yaml"
[[ -f "${COMPOSE_FILE}" ]] || COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose fehlt: ${COMPOSE_FILE}" >&2
  exit 1
fi

FQDN="${COOLIFY_FQDN:-}"
if [[ -z "${FQDN}" && -f "${COMPOSE_DIR}/.env" ]]; then
  FQDN="$(grep -E '^COOLIFY_FQDN=' "${COMPOSE_DIR}/.env" | head -1 | cut -d= -f2- | tr -d "\"'")"
fi
if [[ -z "${FQDN}" && -f "${COMPOSE_DIR}/.env" ]]; then
  FQDN="$(grep -E '^NEXT_PUBLIC_SITE_URL=' "${COMPOSE_DIR}/.env" | head -1 | sed -E 's#^NEXT_PUBLIC_SITE_URL=https?://##' | tr -d "\"'")"
fi
FQDN="${FQDN:-new.gwada.app}"

python3 - "${COMPOSE_FILE}" "${FQDN}" "${APP_ID}" <<'PY'
import pathlib
import sys

path, fqdn, app_id = sys.argv[1:4]
text = pathlib.Path(path).read_text()
needle = f"Host(`{fqdn}`)"
if needle in text and "traefik.http.routers.https-0-" in text:
    print(f"Traefik-FQDN bereits gesetzt ({fqdn}).")
    sys.exit(0)

http_rule = (
    f"            - 'traefik.http.routers.http-0-{app_id}.rule=Host(`{fqdn}`) && PathPrefix(`/`)'\n"
)
https_block = f"""            - traefik.http.routers.https-0-{app_id}.entryPoints=https
            - traefik.http.routers.https-0-{app_id}.middlewares=gzip
            - 'traefik.http.routers.https-0-{app_id}.rule=Host(`{fqdn}`) && PathPrefix(`/`)'
            - traefik.http.routers.https-0-{app_id}.tls=true
            - traefik.http.routers.https-0-{app_id}.tls.certresolver=letsencrypt
            - traefik.http.routers.https-0-{app_id}.service=http-0-{app_id}
"""

import re

text, n = re.subn(
    rf"            - traefik\.http\.routers\.http-0-{re.escape(app_id)}\.middlewares=gzip\n",
    f"            - traefik.http.routers.http-0-{app_id}.middlewares=redirect-to-https,gzip\n",
    text,
    count=1,
)
if n == 0:
    print("WARNUNG: http middleware-Zeile nicht gefunden.", file=sys.stderr)

text, n = re.subn(
    rf"            - 'traefik\.http\.routers\.http-0-{re.escape(app_id)}\.rule=Host\(`[^`]+`\) && PathPrefix\(`/`\)'\n",
    http_rule,
    text,
    count=1,
)
if n == 0:
    print("WARNUNG: http Host-Rule nicht ersetzt.", file=sys.stderr)

svc = f"traefik.http.services.http-0-{app_id}.loadbalancer.server.port"
marker = f"            - {svc}"
if marker not in text:
    print(f"Marker fehlt: {marker}", file=sys.stderr)
    sys.exit(1)
if f"traefik.http.routers.https-0-{app_id}.entryPoints=https" not in text:
    text = text.replace(marker + "\n", marker + "\n" + https_block, 1)

pathlib.Path(path).write_text(text)
print(f"Traefik-Labels für {fqdn} in {path} gesetzt.")
PY

cd "${COMPOSE_DIR}"
docker compose up -d --force-recreate --remove-orphans
echo "Container neu erstellt (Traefik-FQDN ${FQDN})."
