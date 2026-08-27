#!/usr/bin/env bash
# Diagnose: GitHub App mint inside live Coolify app container (SSH).
set -euo pipefail

if [ -z "${LIVE_SSH_KEY:-}" ] || [ -z "${LIVE_VPS_HOST:-}" ]; then
  echo "::error::LIVE_SSH missing"
  exit 1
fi

sudo apt-get update -qq
sudo apt-get install -y -qq python3-cryptography >/dev/null

mkdir -p ~/.ssh
printf '%s\n' "${LIVE_SSH_KEY}" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keyscan -H "${LIVE_VPS_HOST}" >> ~/.ssh/known_hosts 2>/dev/null || true

# Script runs on the VPS; keep {{.Names}} as a docker format string (not GHA expression).
ssh -i ~/.ssh/id_ed25519 -o BatchMode=yes "root@${LIVE_VPS_HOST}" 'python3 -' <<'PY'
import subprocess, base64, json, time, urllib.request

cid = subprocess.check_output(
    "docker ps --format '{{.Names}}' | grep d3cg1b54arvue2tcm8u34qty- | head -1",
    shell=True,
    text=True,
).strip()
print("container=" + cid)

def env(k):
    try:
        return subprocess.check_output(["docker", "exec", cid, "printenv", k], text=True).strip()
    except Exception:
        return ""

app_id = env("GITHUB_APP_ID")
inst = env("GITHUB_APP_INSTALLATION_ID")
raw = env("GITHUB_APP_PRIVATE_KEY")
pat = env("GITHUB_DEPLOY_TOKEN")
print(f"app_id={app_id!r} len={len(app_id)}")
print(f"installation_id={inst!r} len={len(inst)}")
print(f"private_key_len={len(raw)} prefix={raw[:24]!r} has_BEGIN={'BEGIN' in raw}")
print(f"pat_set={bool(pat)} pat_len={len(pat)}")
text = raw
if "BEGIN" not in text:
    try:
        text = base64.b64decode(text.replace("\n", "").replace(" ", "")).decode()
    except Exception as e:
        print("b64_decode_fail", e)
        text = raw
text = text.replace("\\n", "\n").strip() + "\n"
print(
    f"decoded_has_BEGIN={'BEGIN' in text} decoded_len={len(text)} "
    f"head={text.splitlines()[0] if text.strip() else ''!r}"
)
try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    key = serialization.load_pem_private_key(text.encode(), password=None)
    print("pem_load_ok")
except Exception as e:
    print("pem_load_fail", type(e).__name__, e)
    raise SystemExit(0)

now = int(time.time())
header = (
    base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    .rstrip(b"=")
    .decode()
)
payload = (
    base64.urlsafe_b64encode(
        json.dumps({"iat": now - 60, "exp": now + 480, "iss": app_id}).encode()
    )
    .rstrip(b"=")
    .decode()
)
data = f"{header}.{payload}".encode()
sig = (
    base64.urlsafe_b64encode(key.sign(data, padding.PKCS1v15(), hashes.SHA256()))
    .rstrip(b"=")
    .decode()
)
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
        print("mint_ok", r.status, "perms", body.get("permissions"))
except Exception as e:
    code = getattr(e, "code", None)
    body = e.read().decode() if hasattr(e, "read") else str(e)
    print("mint_fail", code, body[:500])
if pat:
    req = urllib.request.Request("https://api.github.com/user")
    req.add_header("Authorization", f"Bearer {pat}")
    req.add_header("Accept", "application/vnd.github+json")
    try:
        with urllib.request.urlopen(req) as r:
            print("pat_ok", r.status)
    except Exception as e:
        code = getattr(e, "code", None)
        body = e.read().decode() if hasattr(e, "read") else str(e)
        print("pat_fail", code, body[:200])

import pathlib

p = pathlib.Path("/data/coolify/applications/d3cg1b54arvue2tcm8u34qty/docker-compose.yaml")
print("compose_exists", p.exists())
if p.exists():
    t = p.read_text()
    print("compose_has_environment", "environment:" in t)
    print("compose_has_GITHUB_APP_ID", "GITHUB_APP_ID" in t)
    print("compose_has_env_file", "env_file" in t)
    print("compose_snippet_env:")
    for line in t.splitlines():
        if (
            "environment" in line
            or "GITHUB_APP" in line
            or "env_file" in line
            or "GITHUB_DEPLOY" in line
        ):
            print(f"  {line}")
PY
