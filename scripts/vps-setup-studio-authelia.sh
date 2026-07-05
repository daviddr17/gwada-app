#!/usr/bin/env bash
# Supabase Studio hinter Traefik + Authelia (2FA) auf dem Gwada-VPS.
# Idempotent: Secrets bleiben in /data/coolify/services/authelia-gwada/.env (nicht im Git).
set -euo pipefail

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"
STUDIO_HOST="${GWADA_STUDIO_HOST:-studio.new.gwada.app}"
AUTH_HOST="${GWADA_AUTH_HOST:-auth.new.gwada.app}"
COOKIE_DOMAIN="${GWADA_AUTHELIA_COOKIE_DOMAIN:-new.gwada.app}"
SUPABASE_SERVICE_ID="${GWADA_SUPABASE_COOLIFY_SERVICE_ID:-oogd5syyxiqb1k4g0wy1u9n8}"
STUDIO_CONTAINER="${GWADA_SUPABASE_STUDIO_CONTAINER:-supabase-studio-${SUPABASE_SERVICE_ID}}"
STUDIO_UPSTREAM="${GWADA_SUPABASE_STUDIO_UPSTREAM:-http://${STUDIO_CONTAINER}:3000}"
AUTHELIA_USER="${GWADA_AUTHELIA_USER:-david}"
DEPLOY_DIR="/data/coolify/services/authelia-gwada"

# shellcheck source=scripts/gwada-ssh-lib.sh
source "$(dirname "$0")/gwada-ssh-lib.sh"

echo "Deploy Authelia + Studio-Proxy auf ${SSH_USER}@${VPS}…"
echo "  Studio: https://${STUDIO_HOST}"
echo "  Authelia-Portal: https://${AUTH_HOST}"

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- \
  "${DEPLOY_DIR}" \
  "${STUDIO_HOST}" \
  "${AUTH_HOST}" \
  "${COOKIE_DOMAIN}" \
  "${SUPABASE_SERVICE_ID}" \
  "${STUDIO_UPSTREAM}" \
  "${AUTHELIA_USER}" <<'REMOTE'
set -euo pipefail

DEPLOY_DIR="$1"
STUDIO_HOST="$2"
AUTH_HOST="$3"
COOKIE_DOMAIN="$4"
SUPABASE_NETWORK="$5"
STUDIO_UPSTREAM="$6"
AUTHELIA_USER="$7"
CONFIG_DIR="${DEPLOY_DIR}/config"
ENV_FILE="${DEPLOY_DIR}/.env"
USERS_FILE="${CONFIG_DIR}/users_database.yml"
CREDS_FILE="${DEPLOY_DIR}/INITIAL_CREDENTIALS.txt"

mkdir -p "${CONFIG_DIR}"

rand_hex() {
  openssl rand -hex 32
}

if [[ ! -f "${ENV_FILE}" ]]; then
  TEMP_PASS="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
  SESSION_SECRET="$(rand_hex)"
  JWT_SECRET="$(rand_hex)"
  STORAGE_KEY="$(rand_hex)"
  PASS_HASH="$(docker run --rm authelia/authelia:4.38 authelia crypto hash generate argon2 --password "${TEMP_PASS}" 2>/dev/null | sed -n 's/^Digest: //p')"
  cat > "${ENV_FILE}" <<EOF
AUTHELIA_SESSION_SECRET=${SESSION_SECRET}
AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET=${JWT_SECRET}
AUTHELIA_STORAGE_ENCRYPTION_KEY=${STORAGE_KEY}
AUTHELIA_USER=${AUTHELIA_USER}
AUTHELIA_TEMP_PASSWORD=${TEMP_PASS}
EOF
  chmod 600 "${ENV_FILE}"
  cat > "${CREDS_FILE}" <<EOF
Authelia initial login (change password + enroll TOTP on first visit):
  URL:      https://${AUTH_HOST}
  Username: ${AUTHELIA_USER}
  Password: ${TEMP_PASS}

Delete this file after saving credentials elsewhere:
  rm -f ${CREDS_FILE}
EOF
  chmod 600 "${CREDS_FILE}"
  echo "  ✓ Secrets + temp password written to ${ENV_FILE} and ${CREDS_FILE}"
else
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  if [[ ! -f "${USERS_FILE}" ]]; then
    PASS_HASH="$(docker run --rm authelia/authelia:4.38 authelia crypto hash generate argon2 --password "${AUTHELIA_TEMP_PASSWORD}" 2>/dev/null | sed -n 's/^Digest: //p')"
  fi
  echo "  ✓ Existing ${ENV_FILE} — secrets unchanged"
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

if [[ ! -f "${USERS_FILE}" ]]; then
  cat > "${USERS_FILE}" <<EOF
---
users:
  ${AUTHELIA_USER}:
    disabled: false
    displayname: ${AUTHELIA_USER}
    password: '${PASS_HASH}'
    email: ${AUTHELIA_USER}@gwada.app
    groups:
      - admins
EOF
  chmod 600 "${USERS_FILE}"
  echo "  ✓ users_database.yml created for user ${AUTHELIA_USER}"
fi

cat > "${CONFIG_DIR}/configuration.yml" <<EOF
---
theme: auto

server:
  address: 'tcp://:9091'

log:
  level: info

identity_validation:
  reset_password:
    jwt_secret: '${AUTHELIA_IDENTITY_VALIDATION_RESET_PASSWORD_JWT_SECRET}'

authentication_backend:
  file:
    path: /config/users_database.yml
    password:
      algorithm: argon2
      argon2:
        variant: argon2id
        iterations: 3
        memory: 65536
        parallelism: 4
        key_length: 32
        salt_length: 16

access_control:
  default_policy: deny
  rules:
    - domain: '${AUTH_HOST}'
      policy: bypass
    - domain: '${STUDIO_HOST}'
      policy: two_factor

session:
  name: authelia_session
  secret: '${AUTHELIA_SESSION_SECRET}'
  expiration: 8h
  inactivity: 2h
  cookies:
    - domain: '${COOKIE_DOMAIN}'
      authelia_url: 'https://${AUTH_HOST}'

storage:
  encryption_key: '${AUTHELIA_STORAGE_ENCRYPTION_KEY}'
  local:
    path: /config/db.sqlite3

notifier:
  filesystem:
    filename: /config/notification.txt

totp:
  issuer: gwada.app
  period: 30
  skew: 1
EOF
chmod 600 "${CONFIG_DIR}/configuration.yml"
touch "${CONFIG_DIR}/notification.txt"
chmod 600 "${CONFIG_DIR}/notification.txt" 2>/dev/null || true

cat > "${DEPLOY_DIR}/docker-compose.yml" <<EOF
services:
  authelia:
    image: authelia/authelia:4.38
    container_name: authelia-gwada
    restart: unless-stopped
    volumes:
      - ./config:/config
    networks:
      - coolify
    labels:
      - traefik.enable=true
      - traefik.http.middlewares.gwada-redirect-https.redirectscheme.scheme=https
      - traefik.http.routers.gwada-authelia-http.rule=Host(\`${AUTH_HOST}\`)
      - traefik.http.routers.gwada-authelia-http.entrypoints=http
      - traefik.http.routers.gwada-authelia-http.middlewares=gwada-redirect-https@docker
      - traefik.http.routers.gwada-authelia-http.service=gwada-authelia
      - traefik.http.routers.gwada-authelia-https.rule=Host(\`${AUTH_HOST}\`)
      - traefik.http.routers.gwada-authelia-https.entrypoints=https
      - traefik.http.routers.gwada-authelia-https.tls=true
      - traefik.http.routers.gwada-authelia-https.tls.certresolver=letsencrypt
      - traefik.http.routers.gwada-authelia-https.service=gwada-authelia
      - traefik.http.services.gwada-authelia.loadbalancer.server.port=9091
      - traefik.http.middlewares.gwada-authelia-forwardauth.forwardauth.address=http://authelia-gwada:9091/api/verify?rd=https://${AUTH_HOST}/
      - traefik.http.middlewares.gwada-authelia-forwardauth.forwardauth.trustForwardHeader=true
      - traefik.http.middlewares.gwada-authelia-forwardauth.forwardauth.authResponseHeaders=Remote-User,Remote-Groups,Remote-Name,Remote-Email

  studio-gateway:
    image: traefik/whoami:v1.10.3
    container_name: gwada-studio-gateway
    restart: unless-stopped
    networks:
      - coolify
      - supabase
    labels:
      - traefik.enable=true
      - traefik.http.middlewares.gwada-redirect-https.redirectscheme.scheme=https
      - traefik.http.routers.gwada-studio-http.rule=Host(\`${STUDIO_HOST}\`)
      - traefik.http.routers.gwada-studio-http.entrypoints=http
      - traefik.http.routers.gwada-studio-http.middlewares=gwada-redirect-https@docker
      - traefik.http.routers.gwada-studio-http.service=gwada-studio
      - traefik.http.routers.gwada-studio-https.rule=Host(\`${STUDIO_HOST}\`)
      - traefik.http.routers.gwada-studio-https.entrypoints=https
      - traefik.http.routers.gwada-studio-https.tls=true
      - traefik.http.routers.gwada-studio-https.tls.certresolver=letsencrypt
      - traefik.http.routers.gwada-studio-https.middlewares=gwada-authelia-forwardauth@docker
      - traefik.http.routers.gwada-studio-https.service=gwada-studio
      - traefik.http.services.gwada-studio.loadbalancer.server.url=${STUDIO_UPSTREAM}

networks:
  coolify:
    external: true
  supabase:
    external: true
    name: ${SUPABASE_NETWORK}
EOF

cd "${DEPLOY_DIR}"
docker compose up -d

echo ""
echo "  DNS (falls noch nicht gesetzt):"
echo "    ${STUDIO_HOST}  A  $(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo "    ${AUTH_HOST}    A  $(curl -4 -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo ""
if [[ -f "${CREDS_FILE}" ]]; then
  echo "  Initial credentials:"
  sed 's/^/    /' "${CREDS_FILE}"
fi
echo "  ✓ authelia-gwada + studio-gateway running"
REMOTE

echo ""
echo "Optional: Coolify-App-Env setzen (Superadmin-Link):"
echo "  GWADA_SUPABASE_STUDIO_URL=https://${STUDIO_HOST}"
echo "  ./scripts/coolify-env-live-proxy.sh   # mit export GWADA_SUPABASE_STUDIO_URL=https://${STUDIO_HOST}"
echo ""
echo "Verify (nach DNS):"
echo "  curl -I https://${STUDIO_HOST}                    # → 302 Authelia"
echo "  curl -I http://${VPS}:54323                       # → timeout/refused"
  echo "  curl -I https://gwada.app                     # → 200/307 App"
