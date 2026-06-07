#!/usr/bin/env bash
# Einmalig (oder nach Node/Corepack-Update): pnpm@9.15.0 aktivieren.
# Behebt Corepack „Cannot find matching keyid“ bei veraltetem Corepack-Bundle.
set -euo pipefail

PNPM_VERSION="${PNPM_VERSION:-9.15.0}"

if command -v corepack >/dev/null 2>&1; then
  corepack enable 2>/dev/null || true
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
  echo "→ pnpm $(pnpm --version) (via corepack)"
  exit 0
fi

if command -v pnpm >/dev/null 2>&1 && pnpm --version 2>/dev/null | grep -q "^${PNPM_VERSION%%.*}"; then
  echo "→ pnpm $(pnpm --version) (bereits installiert)"
  exit 0
fi

echo "corepack nicht gefunden. Alternative:" >&2
echo "  npm install -g pnpm@${PNPM_VERSION}" >&2
exit 1
