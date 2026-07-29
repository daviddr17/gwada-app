#!/usr/bin/env bash
# GitHub App Credentials in Coolify-.env + compose durchreichen, Container neu starten.
# Tokens mintet die Live-App danach selbst — kein ablaufender PAT nötig.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/gwada-ssh-lib.sh
source "${ROOT}/scripts/gwada-ssh-lib.sh"
# shellcheck source=scripts/ensure-coolify-compose-runtime-env.sh
source "${ROOT}/scripts/ensure-coolify-compose-runtime-env.sh"

VPS="${LIVE_VPS_HOST:-95.111.229.250}"
SSH_USER="${LIVE_SSH_USER:-root}"

APP_ID="${GITHUB_APP_ID:-${GWADA_GITHUB_APP_ID:-}}"
INSTALLATION_ID="${GITHUB_APP_INSTALLATION_ID:-${GWADA_GITHUB_APP_INSTALLATION_ID:-}}"
PRIVATE_KEY_RAW="${GITHUB_APP_PRIVATE_KEY:-${GWADA_GITHUB_APP_PRIVATE_KEY:-}}"

if [[ -z "${APP_ID}" || -z "${INSTALLATION_ID}" || -z "${PRIVATE_KEY_RAW}" ]]; then
  echo "GITHUB_APP_ID / GITHUB_APP_INSTALLATION_ID / GITHUB_APP_PRIVATE_KEY fehlen." >&2
  echo "GitHub Secrets: GWADA_GITHUB_APP_ID, GWADA_GITHUB_APP_INSTALLATION_ID, GWADA_GITHUB_APP_PRIVATE_KEY" >&2
  exit 1
fi

# Private Key als Base64 speichern (mehrzeilig-sicher in .env).
PRIVATE_KEY_B64="$(
  PRIVATE_KEY_RAW="${PRIVATE_KEY_RAW}" python3 - <<'PY'
import base64
import os

raw = os.environ["PRIVATE_KEY_RAW"]
text = raw
if "BEGIN" not in text:
    try:
        decoded = base64.b64decode(
            text.replace("\n", "").replace(" ", ""),
            validate=False,
        ).decode("utf-8")
        if "BEGIN" in decoded:
            text = decoded
    except Exception:
        pass
text = text.replace("\\n", "\n").strip() + "\n"
if "BEGIN" not in text or "PRIVATE KEY" not in text:
    raise SystemExit("PRIVATE_KEY ist kein gültiges PEM (BEGIN PRIVATE KEY fehlt).")
print(base64.b64encode(text.encode("utf-8")).decode("ascii"), end="")
PY
)"

if ! gwada_ssh "${SSH_USER}@${VPS}" true; then
  echo "SSH fehlgeschlagen (${SSH_USER}@${VPS})." >&2
  exit 1
fi

# Vorab Mint-Test mit denselben Secret-Werten (ohne VPS).
python3 - <<PY
import base64, json, time, urllib.request
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

app_id = ${APP_ID@Q}
inst = ${INSTALLATION_ID@Q}
pem = base64.b64decode(${PRIVATE_KEY_B64@Q}).decode()
print(f"preflight app_id={app_id!r} installation_id={inst!r} pem_lines={len(pem.splitlines())}")
key = serialization.load_pem_private_key(pem.encode(), password=None)
now = int(time.time())
header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).rstrip(b"=").decode()
payload = base64.urlsafe_b64encode(
    json.dumps({"iat": now - 60, "exp": now + 480, "iss": str(app_id)}).encode()
).rstrip(b"=").decode()
data = f"{header}.{payload}".encode()
sig = base64.urlsafe_b64encode(key.sign(data, padding.PKCS1v15(), hashes.SHA256())).rstrip(b"=").decode()
jwt = f"{header}.{payload}.{sig}"
req = urllib.request.Request(
    f"https://api.github.com/app/installations/{inst}/access_tokens",
    data=b"{}",
    method="POST",
)
req.add_header("Accept", "application/vnd.github+json")
req.add_header("Authorization", f"Bearer {jwt}")
req.add_header("X-GitHub-Api-Version", "2022-11-28")
req.add_header("Content-Type", "application/json")
try:
    with urllib.request.urlopen(req) as r:
        body = json.loads(r.read().decode())
        print(f"✓ preflight mint ok HTTP {r.status} perms={body.get('permissions')}")
except Exception as e:
    code = getattr(e, "code", None)
    detail = e.read().decode() if hasattr(e, "read") else str(e)
    print(f"::error::preflight mint failed HTTP {code}: {detail[:500]}")
    raise SystemExit(1)
PY

gwada_ssh "${SSH_USER}@${VPS}" bash -s -- \
  "${APP_ID}" \
  "${INSTALLATION_ID}" \
  "${PRIVATE_KEY_B64}" <<'REMOTE'
set -euo pipefail
app_id="$1"
installation_id="$2"
private_key_b64="$3"
coolify_app_id="${GWADA_COOLIFY_APP_UUID:-d3cg1b54arvue2tcm8u34qty}"
compose_dir="/data/coolify/applications/${coolify_app_id}"

if [[ ! -d "${compose_dir}" ]]; then
  echo "Coolify-Verzeichnis fehlt: ${compose_dir}" >&2
  exit 1
fi

patch_env() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  # Abgelaufenen PAT entfernen — sonst fällt die App auf 401 zurück.
  grep -vE '^(GITHUB_APP_ID|GITHUB_APP_INSTALLATION_ID|GITHUB_APP_PRIVATE_KEY|GITHUB_DEPLOY_TOKEN|GWADA_GITHUB_DEPLOY_TOKEN)=' "$f" > "${f}.tmp" || true
  {
    printf 'GITHUB_APP_ID=%s\n' "${app_id}"
    printf 'GITHUB_APP_INSTALLATION_ID=%s\n' "${installation_id}"
    printf 'GITHUB_APP_PRIVATE_KEY=%s\n' "${private_key_b64}"
  } >> "${f}.tmp"
  mv "${f}.tmp" "$f"
  echo "  GitHub App Credentials gesetzt in ${f} (PAT entfernt)"
}

for f in "${compose_dir}/.env" "${compose_dir}/.env.production"; do
  patch_env "$f"
done

# Compose muss Keys + env_file durchreichen (Coolify oft ohne environment:-Block).
python3 - "${compose_dir}/docker-compose.yaml" \
  GITHUB_APP_ID GITHUB_APP_INSTALLATION_ID GITHUB_APP_PRIVATE_KEY <<'PY'
import re
import sys
from pathlib import Path

compose = Path(sys.argv[1])
if not compose.is_file():
    compose = Path(str(compose).replace("docker-compose.yaml", "docker-compose.yml"))
keys = sys.argv[2:]
text = compose.read_text()
changed = False

for key in keys:
    ref_line = f"- {key}=${{{key}}}"
    if re.search(rf"^\s*-\s*{re.escape(key)}=", text, re.M):
        continue
    env_block = re.search(r"^(\s+)environment:\s*$", text, re.M)
    if env_block:
        indent = env_block.group(1) + "  "
        text = text[: env_block.end()] + f"{indent}{ref_line}\n" + text[env_block.end() :]
        print(f"compose: {key} unter environment ergänzt")
        changed = True
        continue
    service = re.search(
        r"(^  \S+:\n(?:    .+\n)+?)(?=^  \S+:|^networks:|^volumes:|\Z)",
        text,
        re.M,
    )
    if not service:
        print(f"WARNUNG: service-Block für {key} nicht gefunden", file=sys.stderr)
        continue
    block = service.group(1)
    if re.search(r"^\s*environment:\s*$", block, re.M):
        continue
    new_block = block.rstrip("\n") + "\n    environment:\n      " + ref_line + "\n"
    text = text.replace(block, new_block, 1)
    print(f"compose: environment-Block mit {key} angelegt")
    changed = True

if not re.search(r"^\s*env_file:\s*$", text, re.M) and not re.search(
    r"^\s*-\s*\.env\s*$", text, re.M
):
    service = re.search(
        r"(^  \S+:\n(?:    .+\n)+?)(?=^  \S+:|^networks:|^volumes:|\Z)",
        text,
        re.M,
    )
    if service:
        block = service.group(1)
        if "env_file:" not in block:
            new_block = block.rstrip("\n") + "\n    env_file:\n      - .env\n"
            text = text.replace(block, new_block, 1)
            print("compose: env_file .env ergänzt")
            changed = True

# Abgelaufenen PAT aus compose environment streichen
new_lines = []
for line in text.splitlines(keepends=True):
    if re.search(r"^\s*-\s*GITHUB_DEPLOY_TOKEN=", line) or re.search(
        r"^\s*-\s*GWADA_GITHUB_DEPLOY_TOKEN=", line
    ):
        print("compose: GITHUB_DEPLOY_TOKEN-Zeile entfernt")
        changed = True
        continue
    new_lines.append(line)
text = "".join(new_lines)

if changed:
    compose.write_text(text)
PY

cd "${compose_dir}"
docker compose up -d --force-recreate --remove-orphans

running="$(docker ps --format '{{.Names}}' | grep "${coolify_app_id}-" | head -1 || true)"
if [[ -z "${running}" ]]; then
  echo "WARNUNG: App-Container nicht gefunden" >&2
  exit 1
fi

ok=1
for key in GITHUB_APP_ID GITHUB_APP_INSTALLATION_ID GITHUB_APP_PRIVATE_KEY; do
  if docker exec "${running}" printenv "${key}" 2>/dev/null | grep -q .; then
    echo "✓ ${key} im Container gesetzt"
  else
    echo "WARNUNG: ${key} fehlt im laufenden Container" >&2
    ok=0
  fi
done
if docker exec "${running}" printenv GITHUB_DEPLOY_TOKEN 2>/dev/null | grep -q .; then
  echo "WARNUNG: GITHUB_DEPLOY_TOKEN noch im Container — sollte entfernt sein" >&2
else
  echo "✓ abgelaufener GITHUB_DEPLOY_TOKEN nicht mehr im Container"
fi

# Mint-Test im laufenden App-Container (Node ist vorhanden)
docker exec -i "${running}" node - <<'NODE'
const { createPrivateKey, createSign } = require("crypto");
const appId = process.env.GITHUB_APP_ID;
const inst = process.env.GITHUB_APP_INSTALLATION_ID;
let key = process.env.GITHUB_APP_PRIVATE_KEY || "";
if (!appId || !inst || !key) {
  console.error("container mint: env incomplete", {
    appId: Boolean(appId),
    inst: Boolean(inst),
    keyLen: key.length,
  });
  process.exit(1);
}
if (!key.includes("BEGIN")) {
  key = Buffer.from(key.replace(/\s+/g, ""), "base64").toString("utf8");
}
key = key.replace(/\\n/g, "\n").trim();
const now = Math.floor(Date.now() / 1000);
const header = Buffer.from(
  JSON.stringify({ alg: "RS256", typ: "JWT" }),
).toString("base64url");
const payload = Buffer.from(
  JSON.stringify({ iat: now - 60, exp: now + 480, iss: appId }),
).toString("base64url");
const data = `${header}.${payload}`;
const signer = createSign("RSA-SHA256");
signer.update(data);
signer.end();
const jwt = `${data}.${signer.sign(createPrivateKey(key)).toString("base64url")}`;
fetch(
  `https://api.github.com/app/installations/${encodeURIComponent(inst)}/access_tokens`,
  {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  },
)
  .then(async (r) => {
    const t = await r.text();
    if (!r.ok) {
      console.error("container mint fail", r.status, t.slice(0, 400));
      process.exit(1);
    }
    console.log("✓ container mint ok", r.status);
  })
  .catch((e) => {
    console.error("container mint error", e);
    process.exit(1);
  });
NODE

if [[ "${ok}" -ne 1 ]]; then
  exit 1
fi
echo "✓ GitHub App Credentials im Container aktiv"
REMOTE

echo "✓ GitHub App Credentials auf VPS synchronisiert"
