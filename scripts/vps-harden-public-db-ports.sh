#!/usr/bin/env bash
# Live-VPS härten: SSH nur noch Public-Key, fail2ban für sshd,
# öffentliche Direct-Ports (DB/Studio/Kong/App-3000/Coolify-8000) zu.
# SSH + 80/443 bleiben. CI-Keys in authorized_keys werden nicht angefasst.
# Coolify-UI danach: ssh -L 8000:127.0.0.1:8000 -N root@<VPS> → http://127.0.0.1:8000
set -euo pipefail

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"

# shellcheck source=scripts/gwada-ssh-lib.sh
source "$(dirname "$0")/gwada-ssh-lib.sh"

gwada_ssh "${SSH_USER}@${VPS}" bash <<'REMOTE'
set -euo pipefail

echo "=== authorized_keys (CI/Deploy-Keys bleiben) ==="
if [[ ! -s /root/.ssh/authorized_keys ]]; then
  echo "ABORT: /root/.ssh/authorized_keys fehlt oder leer — Password-Auth würde uns aussperren." >&2
  exit 1
fi
key_count="$(grep -cE '^(ssh-|ecdsa-|sk-)' /root/.ssh/authorized_keys || true)"
if [[ "${key_count}" -lt 1 ]]; then
  echo "ABORT: keine Public-Keys in authorized_keys." >&2
  exit 1
fi
echo "  ${key_count} Key(s):"
ssh-keygen -lf /root/.ssh/authorized_keys || true

echo ""
echo "=== sshd: PasswordAuthentication no (Pubkey bleibt) ==="
sshd_dropin="/etc/ssh/sshd_config.d/00-gwada-pubkey-only.conf"
mkdir -p /etc/ssh/sshd_config.d
cat > "${sshd_dropin}" <<'SSHD'
# Gwada: kein Passwort-Login. Root per Key bleibt (GitHub Actions LIVE_SSH_KEY).
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
SSHD

# Erste gesetzte Option gilt — vorhandenes "yes" in allen Configs auf no drehen.
# PermitRootLogin nicht auf "no" setzen (CI loggt als root mit Key).
while IFS= read -r -d '' cfg; do
  sed -i -E \
    -e 's/^[[:space:]]*PasswordAuthentication[[:space:]]+yes/PasswordAuthentication no/I' \
    -e 's/^[[:space:]]*KbdInteractiveAuthentication[[:space:]]+yes/KbdInteractiveAuthentication no/I' \
    -e 's/^[[:space:]]*ChallengeResponseAuthentication[[:space:]]+yes/ChallengeResponseAuthentication no/I' \
    -e 's/^[[:space:]]*PermitRootLogin[[:space:]]+yes/PermitRootLogin prohibit-password/I' \
    "${cfg}"
done < <(find /etc/ssh -name 'sshd_config' -print0; find /etc/ssh/sshd_config.d -name '*.conf' -print0 2>/dev/null || true)

if ! sshd -t 2>/tmp/sshd-t.err; then
  echo "ABORT: sshd -t fehlgeschlagen:" >&2
  cat /tmp/sshd-t.err >&2
  exit 1
fi
if systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null; then
  echo "  sshd neu geladen"
else
  systemctl restart ssh 2>/dev/null || systemctl restart sshd
  echo "  sshd neu gestartet"
fi
echo "  sshd -T (relevant):"
sshd -T 2>/dev/null | grep -Ei '^(passwordauthentication|kbdinteractiveauthentication|challengeresponseauthentication|pubkeyauthentication|permitrootlogin|authenticationmethods) ' || true

echo ""
echo "=== fail2ban (sshd) ==="
export DEBIAN_FRONTEND=noninteractive
if ! command -v fail2ban-client >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq fail2ban
fi
mkdir -p /etc/fail2ban
# CI retried SSH mehrfach — maxretry bewusst hoch, damit GitHub Actions nicht gebannt wird.
cat > /etc/fail2ban/jail.d/gwada-sshd.local <<'JAIL'
[sshd]
enabled = true
backend = systemd
maxretry = 20
findtime = 600
bantime = 3600
ignoreip = 127.0.0.1/8 ::1
JAIL
systemctl enable --now fail2ban
systemctl restart fail2ban
sleep 1
fail2ban-client status sshd || fail2ban-client status || true

echo ""
echo "=== ufw: 22/80/443 allow; Direct-Ports deny (inkl. Coolify 8000) ==="
if command -v ufw >/dev/null 2>&1; then
  echo "  ufw-Status (vorher):"
  ufw status numbered 2>/dev/null | head -40 || true

  ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true

  remove_allow_for_port() {
    local port="$1"
    while ufw status numbered 2>/dev/null | grep -E "^\[[[:space:]]*[0-9]+\][[:space:]]+${port}(/tcp)?[[:space:]]+ALLOW" >/dev/null; do
      local num
      num="$(ufw status numbered 2>/dev/null | grep -E "^\[[[:space:]]*[0-9]+\][[:space:]]+${port}(/tcp)?[[:space:]]+ALLOW" | head -1 | sed -E 's/^\[ *([0-9]+)\].*/\1/')"
      echo "  ufw delete ALLOW ${port} (#${num})"
      ufw --force delete "${num}" >/dev/null 2>&1 || break
    done
  }

  for port in 5432 54321 54322 54323 8001 3000 8000; do
    remove_allow_for_port "${port}"
    ufw deny "${port}/tcp" >/dev/null 2>&1 || true
  done

  if ufw status | grep -q inactive; then
    echo "  ufw war inactive — aktiviere"
    ufw --force enable >/dev/null 2>&1 || true
  fi

  echo ""
  echo "  ufw-Status (nachher):"
  ufw status numbered 2>/dev/null | head -40 || true
else
  echo "  ufw nicht installiert — überspringe ufw (iptables/DOCKER-USER folgt)"
fi

echo ""
echo "=== Docker: 3000/8000 auf 127.0.0.1 binden (UFW greift bei published ports oft nicht) ==="
bind_compose_port() {
  local file="$1"
  local from="$2"
  local to="$3"
  [[ -f "$file" ]] || return 1
  if grep -qF "${to}" "$file"; then
    return 1
  fi
  if grep -qF "${from}" "$file"; then
    # Nicht 8000:8080 innerhalb schon gesetztem 127.0.0.1:8000:8080 ersetzen.
    if command -v python3 >/dev/null 2>&1 && python3 - "$file" "$from" "$to" <<'PY'
import sys
from pathlib import Path
path, src, dst = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
text = path.read_text()
out, i, n = [], 0, 0
while True:
    j = text.find(src, i)
    if j < 0:
        out.append(text[i:])
        break
    prefix = text[max(0, j - len("127.0.0.1:")) : j]
    if prefix.endswith("127.0.0.1:"):
        out.append(text[i:j + len(src)])
        i = j + len(src)
        continue
    out.append(text[i:j])
    out.append(dst)
    i = j + len(src)
    n += 1
if n:
    path.write_text("".join(out))
    sys.exit(0)
sys.exit(1)
PY
    then
      echo "  compose: ${file} — ${from} → ${to}"
      return 0
    fi
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

# Coolify-UI selbst (typisch 8000:8080 oder 8000:8000)
for compose in \
  /data/coolify/source/docker-compose.yml \
  /data/coolify/source/docker-compose.prod.yml \
  /data/coolify/source/docker-compose.prod.yaml \
  /data/coolify/docker-compose.yml
do
  bind_compose_port "$compose" '"8000:8080"' '"127.0.0.1:8000:8080"' && patched=1 || true
  bind_compose_port "$compose" "'8000:8080'" "'127.0.0.1:8000:8080'" && patched=1 || true
  bind_compose_port "$compose" "- 8000:8080" "- 127.0.0.1:8000:8080" && patched=1 || true
  bind_compose_port "$compose" "8000:8080" "127.0.0.1:8000:8080" && patched=1 || true
  bind_compose_port "$compose" '"8000:8000"' '"127.0.0.1:8000:8000"' && patched=1 || true
  bind_compose_port "$compose" "- 8000:8000" "- 127.0.0.1:8000:8000" && patched=1 || true
  bind_compose_port "$compose" "8000:8000" "127.0.0.1:8000:8000" && patched=1 || true
  bind_compose_port "$compose" "0.0.0.0:8000:" "127.0.0.1:8000:" && patched=1 || true
done

if [[ "$patched" -eq 1 ]]; then
  echo "  Docker-Compose neu starten (nur betroffene Stacks)…"
  for svc_dir in /data/coolify/services/*/; do
    compose="${svc_dir}docker-compose.yml"
    [[ -f "$compose" ]] || continue
    (cd "$svc_dir" && docker compose up -d supabase-kong supabase-studio 2>/dev/null) || true
  done
  for app_dir in /data/coolify/applications/*/; do
    compose="${app_dir}docker-compose.yaml"
    [[ -f "$compose" ]] || compose="${app_dir}docker-compose.yml"
    [[ -f "$compose" ]] || continue
    if grep -qE '127\.0\.0\.1:3000:3000' "$compose" 2>/dev/null; then
      (cd "$app_dir" && docker compose up -d 2>/dev/null) || true
    fi
  done
  if [[ -d /data/coolify/source ]]; then
    (cd /data/coolify/source && docker compose up -d 2>/dev/null) || true
  fi
fi

echo ""
echo "=== iptables DOCKER-USER: WAN 3000/8000 drop; localhost bleibt (SSH-Tunnel) ==="
install -d /usr/local/sbin
cat > /usr/local/sbin/gwada-docker-user-filter.sh <<'FILTER'
#!/usr/bin/env bash
set -euo pipefail
if ! command -v iptables >/dev/null 2>&1; then
  echo "iptables fehlt" >&2
  exit 0
fi
for _try in 1 2 3 4 5 6 7 8 9 10; do
  if iptables -nL DOCKER-USER >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! iptables -nL DOCKER-USER >/dev/null 2>&1; then
  echo "DOCKER-USER existiert nicht — Docker nicht aktiv?" >&2
  exit 0
fi
iptables -N GWADA-PUB-DENY 2>/dev/null || true
iptables -F GWADA-PUB-DENY
# Loopback/original dest 127.0.0.1: Coolify-Tunnel und lokale Healthchecks.
iptables -A GWADA-PUB-DENY -m conntrack --ctorigdst 127.0.0.1 -j RETURN
iptables -A GWADA-PUB-DENY -p tcp -m conntrack --ctorigdstport 3000 -j DROP
iptables -A GWADA-PUB-DENY -p tcp -m conntrack --ctorigdstport 8000 -j DROP
# Nach DNAT: App 3000:3000 bleibt dport 3000; Coolify oft 8000:8080.
iptables -A GWADA-PUB-DENY -p tcp --dport 3000 -j DROP
iptables -A GWADA-PUB-DENY -p tcp --dport 8000 -j DROP
if ! iptables -C DOCKER-USER -j GWADA-PUB-DENY 2>/dev/null; then
  iptables -I DOCKER-USER -j GWADA-PUB-DENY
fi
echo "GWADA-PUB-DENY in DOCKER-USER aktiv"
FILTER
chmod 755 /usr/local/sbin/gwada-docker-user-filter.sh
/usr/local/sbin/gwada-docker-user-filter.sh || true

cat > /etc/systemd/system/gwada-docker-user-filter.service <<'UNIT'
[Unit]
Description=Drop public Docker-published ports 3000 and 8000 (localhost tunnel OK)
After=docker.service network-online.target
Wants=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/gwada-docker-user-filter.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now gwada-docker-user-filter.service

echo ""
echo "=== Listener 3000/8000 (Host) ==="
ss -lntp 2>/dev/null | grep -E ':3000|:8000' || echo "  (kein Host-Listener auf 3000/8000 — oder nur in Docker)"
docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E '3000|8000' || true

echo ""
echo "=== Coolify-UI ==="
echo "  Öffentlich geschlossen. Lokal: ssh -N -L 8000:127.0.0.1:8000 ${USER:-root}@$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "  dann http://127.0.0.1:8000"

echo ""
echo "=== sshd Effective ==="
sshd -T 2>/dev/null | grep -Ei '^(passwordauthentication|pubkeyauthentication|permitrootlogin) ' || true

echo ""
echo "  ✓ SSH: pubkey only (PasswordAuthentication no). fail2ban sshd. Öffentlich: 22/80/443."
echo "  ✓ 3000/8000: ufw deny + DOCKER-USER drop + localhost-Bind wo Compose gefunden."
echo "  ✓ CI-Keys unangetastet. PermitRootLogin prohibit-password."
REMOTE

# Zweiter SSH-Call: gleicher Pfad wie Deploy — Key-Login muss nach sshd-Reload noch gehen.
echo ""
echo "=== Post-check: Key-Login (wie deploy-live-app) ==="
gwada_ssh "${SSH_USER}@${VPS}" bash -c 'echo KEY_LOGIN_OK; sshd -T | grep -Ei "^(passwordauthentication|pubkeyauthentication|permitrootlogin) "'
echo "  Key-Login nach Härten: OK"
