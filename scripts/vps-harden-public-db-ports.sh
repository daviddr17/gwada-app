#!/usr/bin/env bash
# Schließt öffentliche DB/Studio/Kong-Ports am VPS (SSH bleibt offen).
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

echo "  ufw-Status:"
ufw status verbose 2>/dev/null | head -20 || true

# Basis: SSH + Web
ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true

# Supabase/Postgres nicht öffentlich (App nutzt /sb intern)
for port in 5432 54323 8001; do
  ufw deny "${port}/tcp" >/dev/null 2>&1 || true
done

# Nicht interaktiv aktivieren falls noch inactive
if ufw status | grep -q inactive; then
  echo "  ufw war inactive — aktiviere (y)"
  ufw --force enable >/dev/null 2>&1 || true
fi

echo "  ✓ ufw: 5432, 54323, 8001 denied (öffentlich); 22/80/443 erlaubt"
ufw status numbered 2>/dev/null | head -25 || true
REMOTE
