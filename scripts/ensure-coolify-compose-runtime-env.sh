#!/usr/bin/env bash
# Coolify: Secrets in .env reichen nicht — docker-compose muss sie an den Container durchreichen.
set -euo pipefail

ensure_coolify_compose_runtime_env() {
  local compose_dir="$1"
  shift
  local keys=("$@")
  local compose_file="${compose_dir}/docker-compose.yaml"
  [[ -f "${compose_file}" ]] || compose_file="${compose_dir}/docker-compose.yml"
  [[ -f "${compose_file}" ]] || {
    echo "Compose fehlt in ${compose_dir}" >&2
    return 1
  }

  python3 - "${compose_file}" "${keys[@]}" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
keys = sys.argv[2:]
text = path.read_text()

for key in keys:
    ref_line = f"- {key}=${{{key}}}"
    if re.search(rf"^\s*-\s*{re.escape(key)}=", text, re.M):
        continue
    env_block = re.search(r"^(\s+)environment:\s*$", text, re.M)
    if env_block:
        indent = env_block.group(1) + "  "
        insert = f"{indent}{ref_line}\n"
        pos = env_block.end()
        text = text[:pos] + insert + text[pos:]
        print(f"compose: {key} unter environment ergänzt")
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
    if "environment:" in block:
        continue
    new_block = block.rstrip("\n") + "\n    environment:\n      " + ref_line + "\n"
    text = text.replace(block, new_block, 1)
    print(f"compose: environment-Block mit {key} angelegt")

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

path.write_text(text)
PY
}

verify_container_env() {
  local container="$1"
  local key="$2"
  if docker exec "${container}" printenv "${key}" 2>/dev/null | grep -q .; then
    echo "✓ ${key} im Container gesetzt"
    return 0
  fi
  echo "WARNUNG: ${key} fehlt im laufenden Container" >&2
  return 1
}
