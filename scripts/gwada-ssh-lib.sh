#!/usr/bin/env bash
# Gemeinsame SSH-Optionen für VPS-Skripte (Mac → Contabo).
GWADA_SSH_IDENTITY="${GWADA_SSH_IDENTITY:-${HOME}/.ssh/gwada_vps_ed25519}"
if [[ ! -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH_IDENTITY="${HOME}/.ssh/id_ed25519"
fi
GWADA_SSH=( -o ConnectTimeout=15 )

# Nur für nicht-interaktive CI: GWADA_SSH_BATCH=1 setzen
if [[ -n "${GWADA_SSH_BATCH:-}" ]]; then
  GWADA_SSH+=(
    -o BatchMode=yes
    -o ServerAliveInterval=30
    -o ServerAliveCountMax=120
    -o TCPKeepAlive=yes
  )
fi

if [[ -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH+=( -i "${GWADA_SSH_IDENTITY}" )
fi

gwada_ssh() {
  local max_attempts="${GWADA_SSH_MAX_ATTEMPTS:-5}"
  local attempt=1
  while (( attempt <= max_attempts )); do
    if ssh "${GWADA_SSH[@]}" "$@"; then
      return 0
    fi
    if (( attempt < max_attempts )); then
      echo "SSH fehlgeschlagen (Versuch ${attempt}/${max_attempts}), erneut in 12s …" >&2
      sleep 12
    fi
    attempt=$((attempt + 1))
  done
  return 1
}
