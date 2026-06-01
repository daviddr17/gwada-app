#!/usr/bin/env bash
# Gwada-App-Container muss das Supabase-Coolify-Service-Netz teilen, sonst /sb → 502.
set -euo pipefail

COMPOSE_DIR="${1:-${GWADA_COOLIFY_COMPOSE_DIR:-}}"
APP_ID="${2:-${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}}"
SUPABASE_NET="${GWADA_SUPABASE_DOCKER_NETWORK:-oogd5syyxiqb1k4g0wy1u9n8}"

if [[ -z "${COMPOSE_DIR}" ]]; then
  COMPOSE_DIR="/data/coolify/applications/${APP_ID}"
fi

COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yaml"
[[ -f "${COMPOSE_FILE}" ]] || COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yml"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose fehlt: ${COMPOSE_FILE}" >&2
  exit 1
fi

if ! docker network inspect "${SUPABASE_NET}" >/dev/null 2>&1; then
  echo "WARNUNG: Supabase-Netz ${SUPABASE_NET} nicht gefunden — übersprungen." >&2
  exit 0
fi

python3 - "${COMPOSE_FILE}" "${SUPABASE_NET}" "${APP_ID}" <<'PY'
import pathlib
import re
import sys

path, supabase_net, app_id = sys.argv[1:4]
text = pathlib.Path(path).read_text()

if f"name: {supabase_net}" in text and "supabase:" in text:
    print(f"Supabase-Netz bereits in Compose ({supabase_net}).")
    sys.exit(0)

# networks: coolify block erweitern
if re.search(r"^\s+supabase:\s*$", text, re.M):
    pass
elif "networks:" in text and "name: coolify" in text:
    text = re.sub(
        r"(networks:\n\s+coolify:\n\s+external: true\n\s+name: coolify\n\s+attachable: true)",
        rf"\1\n    supabase:\n        external: true\n        name: {supabase_net}",
        text,
        count=1,
    )
else:
    print("WARNUNG: networks:-Block nicht erkannt — manuell prüfen.", file=sys.stderr)

# service networks: supabase hinzufügen (erster Service mit coolify-Netz)
svc_net_pat = re.compile(
    rf"(^\s+networks:\n\s+coolify:\n\s+aliases:\n(?:\s+- .+\n)+)",
    re.M,
)
m = svc_net_pat.search(text)
if m and "supabase:" not in m.group(1):
    text = svc_net_pat.sub(r"\1            supabase: {}\n", text, count=1)

pathlib.Path(path).write_text(text)
print(f"Compose: Supabase-Netz {supabase_net} ergänzt.")
PY

RUNNING="$(docker ps --format '{{.Names}}' | grep "${APP_ID}-" | head -1 || true)"
if [[ -n "${RUNNING}" ]]; then
  if docker network inspect "${SUPABASE_NET}" --format '{{range .Containers}}{{.Name}} {{end}}' \
    | grep -q "${RUNNING}"; then
    echo "Container ${RUNNING} bereits im Netz ${SUPABASE_NET}."
  else
    docker network connect "${SUPABASE_NET}" "${RUNNING}" 2>/dev/null \
      && echo "Container ${RUNNING} → Netz ${SUPABASE_NET} verbunden." \
      || echo "WARNUNG: network connect fehlgeschlagen (evtl. schon verbunden)." >&2
  fi
fi
