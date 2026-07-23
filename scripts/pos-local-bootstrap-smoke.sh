#!/usr/bin/env bash
# Einmal-Diagnose: lokales Supabase + Next POS-Bootstrap.
set -euo pipefail
cd "$(dirname "$0")/.."

RID="${1:-00000000-0000-4000-8000-000000000001}"
ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

echo "== Env (sollte 127.0.0.1:54321 sein) =="
grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local 2>/dev/null || echo "FEHLT: .env.local"
echo "(Hinweis: pnpm --filter web dev muss .env.local NACH .env.development laden — Script dev:docker = nur lokal)"

echo
echo "== Supabase :54321 =="
if curl -sf --connect-timeout 2 --max-time 5 -o /dev/null -w "auth health HTTP %{http_code}\n" "http://127.0.0.1:54321/auth/v1/health"; then
  :
else
  echo "Supabase nicht erreichbar — npx supabase start"
  exit 1
fi

echo
echo "== Next :3000 =="
# Leichter API-Hit (kein Seiten-Compile); 400 = Server lebt
CODE=$(curl -s --connect-timeout 3 --max-time 60 -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:3000/api/pos/bootstrap?restaurantId=test" || true)
echo "web API HTTP ${CODE}"
if [[ "$CODE" == "000" || -z "$CODE" ]]; then
  echo "Next nicht erreichbar auf 127.0.0.1:3000"
  echo "Start: pnpm --filter web dev:docker   # nutzt nur .env.local"
  exit 1
fi

echo
echo "== Login =="
TOKEN=$(curl -s --connect-timeout 3 --max-time 10 "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON}" \
  -H "Content-Type: application/json" \
  -d '{"email":"dreyer@techlion.de","password":"GwadaLocal2026!"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token') or '')")
if [[ -z "$TOKEN" ]]; then
  echo "Login fehlgeschlagen"
  exit 1
fi
echo "TOKEN_LEN=${#TOKEN}"

echo
echo "== Bootstrap restaurantId=${RID} =="
HTTP=$(curl -s --connect-timeout 3 --max-time 60 -o /tmp/pos-bootstrap.json -w "%{http_code}" \
  "http://127.0.0.1:3000/api/pos/bootstrap?restaurantId=${RID}" \
  -H "Authorization: Bearer ${TOKEN}")
echo "HTTP ${HTTP}"
python3 - <<'PY'
import json
d=json.load(open("/tmp/pos-bootstrap.json"))
if "error" in d:
    print("ERROR:", d)
    raise SystemExit(1)
print("restaurant:", d.get("restaurantName"), d.get("restaurantId"))
print("tables:", len(d.get("floor",{}).get("tables",[])))
print("menu items:", len(d.get("menu",{}).get("items",[])))
print("categories:", len(d.get("menu",{}).get("categories",[])))
PY

echo
echo "OK — in der App: API-Basis http://127.0.0.1:3000 → Cloud-Daten neu laden"
