#!/usr/bin/env bash
# Migrationen auf Dev-DB (.env.development) — Tunnel muss laufen oder CI nutzen.
set -euo pipefail

DEV_PORT="${DEV_TUNNEL_LOCAL_PORT:-5434}"

if ! nc -z 127.0.0.1 "${DEV_PORT}" 2>/dev/null; then
  echo "" >&2
  echo "Dev-DB-Tunnel nicht aktiv (127.0.0.1:${DEV_PORT})." >&2
  echo "" >&2
  echo "Terminal 1:  pnpm db:tunnel:dev" >&2
  echo "Terminal 2:  pnpm db:push" >&2
  echo "" >&2
  echo "Oder per CI:   gh workflow run deploy-dev-db.yml --ref main" >&2
  echo "" >&2
  exit 1
fi

exec dotenv -e .env.development -- bash scripts/db-push-live.sh "$@"
