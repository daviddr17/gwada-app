#!/usr/bin/env bash
# Read-only Inventur Live-VPS (Coolify / Traefik / App / Supabase).
# Keine Secrets ausgeben — nur Keys und Pfade.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
APP_ID="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"

echo "=== Gwada Live Inventur $(date -Is) ${SSH_USER}@${VPS} ==="

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- "${APP_ID}" <<'REMOTE'
set -euo pipefail
APP_ID="$1"

echo "--- host ---"
hostname
uname -a
uptime

echo "--- listening 80/443/8000/3000 ---"
ss -lntup 2>/dev/null | grep -E ':80 |:443 |:8000 |:3000 ' || netstat -lntup 2>/dev/null | grep -E ':80 |:443 |:8000 |:3000 ' || true

echo "--- docker ps (name/image/ports/status) ---"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'

echo "--- coolify applications ---"
ls -la /data/coolify/applications 2>/dev/null || echo "(kein /data/coolify/applications)"
if [[ -d "/data/coolify/applications/${APP_ID}" ]]; then
  echo "APP_DIR=/data/coolify/applications/${APP_ID}"
  ls -la "/data/coolify/applications/${APP_ID}" | head -40
  for f in docker-compose.yaml docker-compose.yml; do
    if [[ -f "/data/coolify/applications/${APP_ID}/${f}" ]]; then
      echo "--- compose ${f} (image/labels excerpt) ---"
      grep -E 'image:|container_name:|traefik\.|ports:|networks:' \
        "/data/coolify/applications/${APP_ID}/${f}" | head -80 || true
    fi
  done
  if [[ -f "/data/coolify/applications/${APP_ID}/.env" ]]; then
    echo "--- app .env keys (no values) ---"
    cut -d= -f1 "/data/coolify/applications/${APP_ID}/.env" | sed '/^$/d' | sed '/^#/d' | sort -u
  fi
fi

echo "--- coolify services ---"
ls -la /data/coolify/services 2>/dev/null || echo "(kein /data/coolify/services)"
for d in /data/coolify/services/*/; do
  [[ -d "$d" ]] || continue
  echo "SERVICE_DIR=$d"
  ls "$d" | head -20
  if [[ -f "${d}docker-compose.yml" ]]; then
    grep -E 'image:|container_name:|traefik\.|ports:' "${d}docker-compose.yml" | head -40 || true
  fi
done

echo "--- coolify proxy / source ---"
ls -la /data/coolify/proxy 2>/dev/null | head -20 || true
ls -la /data/coolify/source 2>/dev/null | head -20 || true
docker ps --format '{{.Names}}' | grep -iE 'coolify|traefik|caddy' || true

echo "--- supabase-ish containers ---"
docker ps --format '{{.Names}}\t{{.Image}}' | grep -iE 'supabase|postgres|kong|gotrue|authelia|studio' || true

echo "--- docker networks (name) ---"
docker network ls --format '{{.Name}}' | head -60

echo "--- /opt/gwada ---"
ls -la /opt/gwada 2>/dev/null || echo "(kein /opt/gwada)"
ls -la /opt/gwada/live 2>/dev/null || true
ls -la /opt/gwada-supabase-dev 2>/dev/null | head -10 || true

echo "--- public build-info (from VPS) ---"
curl -fsS https://gwada.app/api/build-info 2>/dev/null || curl -fsS http://127.0.0.1:3000/api/build-info 2>/dev/null || echo "(build-info unreachable locally)"

echo "=== INVENTORY_OK ==="
REMOTE
