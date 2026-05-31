#!/usr/bin/env bash
# Schließt öffentliche DB/Studio/Kong/App-Direct-Ports am VPS (SSH + 80/443 bleiben).
set -euo pipefail

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"

# shellcheck source=scripts/gwada-ssh-lib.sh
source "$(dirname "$0")/gwada-ssh-lib.sh"

gwada_ssh "${SSH_USER}@${VPS}" bash <<'REMOTE'
set -euo pipefail

if ! command -v ufw >/dev/null 2>&1; then
  echo "  ufw nicht installiert — überspringe (optional: apt install ufw)" >&2
  exit 0
fi

echo "  ufw-Status (vorher):"
ufw status numbered 2>/dev/null | head -30 || true

# Basis: SSH + Web
ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true

# Alte ALLOW-Regeln entfernen (sonst schlägt späteres deny nicht zu — first match wins)
remove_allow_for_port() {
  local port="$1"
  while ufw status numbered 2>/dev/null | grep -E "^\[[[:space:]]*[0-9]+\][[:space:]]+${port}(/tcp)?[[:space:]]+ALLOW" >/dev/null; do
    local num
    num="$(ufw status numbered 2>/dev/null | grep -E "^\[[[:space:]]*[0-9]+\][[:space:]]+${port}(/tcp)?[[:space:]]+ALLOW" | head -1 | sed -E 's/^\[ *([0-9]+)\].*/\1/')"
    echo "  ufw delete ALLOW ${port} (#${num})"
    ufw --force delete "${num}" >/dev/null 2>&1 || break
  done
}

for port in 5432 54321 54322 54323 8001 3000; do
  remove_allow_for_port "${port}"
  ufw deny "${port}/tcp" >/dev/null 2>&1 || true
done

if ufw status | grep -q inactive; then
  echo "  ufw war inactive — aktiviere"
  ufw --force enable >/dev/null 2>&1 || true
fi

echo ""
echo "  ufw-Status (nachher):"
ufw status numbered 2>/dev/null | head -30 || true

# Docker published ports umgehen UFW — auf localhost binden
bind_compose_port() {
  local file="$1"
  local from="$2"
  local to="$3"
  [[ -f "$file" ]] || return 0
  if grep -qF "${from}" "$file"; then
    sed -i "s|${from}|${to}|g" "$file"
    echo "  compose: ${file} — ${from} → ${to}"
    return 0
  fi
  return 1
}

patched=0
for svc_dir in /data/coolify/services/*/; do
  compose="${svc_dir}docker-compose.yml"
  bind_compose_port "$compose" "8001:8000" "127.0.0.1:8001:8000" && patched=1 || true
  bind_compose_port "$compose" "54323:3000" "127.0.0.1:54323:3000" && patched=1 || true
done

for app_dir in /data/coolify/applications/*/; do
  for compose in "${app_dir}docker-compose.yaml" "${app_dir}docker-compose.yml"; do
    bind_compose_port "$compose" "- 3000:3000" "- 127.0.0.1:3000:3000" && patched=1 || true
    bind_compose_port "$compose" "3000:3000" "127.0.0.1:3000:3000" && patched=1 || true
  done
done

if [[ "$patched" -eq 1 ]]; then
  echo "  Docker-Compose neu starten (kong/studio/app)…"
  for svc_dir in /data/coolify/services/*/; do
    compose="${svc_dir}docker-compose.yml"
    [[ -f "$compose" ]] || continue
    (cd "$svc_dir" && docker compose up -d supabase-kong supabase-studio 2>/dev/null) || true
  done
  for app_dir in /data/coolify/applications/*/; do
    compose="${app_dir}docker-compose.yaml"
    [[ -f "$compose" ]] || compose="${app_dir}docker-compose.yml"
    [[ -f "$compose" ]] || continue
    (cd "$app_dir" && docker compose up -d 2>/dev/null) || true
  done
fi

echo "  ✓ Öffentlich: nur 22/80/443 (+ ggf. 8000 Coolify-UI). Studio/Kong/DB/App-3000: ufw deny + localhost-Bind."
echo "  Studio HTTPS: ./scripts/vps-setup-studio-authelia.sh (Traefik + Authelia, unabhängig von Coolify-Redeploys)."
REMOTE
