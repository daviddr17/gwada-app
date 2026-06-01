#!/usr/bin/env bash
# Gemeinsame SSH-Optionen für VPS-Skripte (Mac → Contabo).
GWADA_SSH_IDENTITY="${GWADA_SSH_IDENTITY:-${HOME}/.ssh/gwada_vps_ed25519}"
if [[ ! -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH_IDENTITY="${HOME}/.ssh/id_ed25519"
fi
GWADA_SSH=( -o ConnectTimeout=15 )

# Nur für nicht-interaktive CI: GWADA_SSH_BATCH=1 setzen
if [[ -n "${GWADA_SSH_BATCH:-}" ]]; then
  GWADA_SSH+=( -o BatchMode=yes )
fi

if [[ -f "${GWADA_SSH_IDENTITY}" ]]; then
  GWADA_SSH+=( -i "${GWADA_SSH_IDENTITY}" )
fi

gwada_ssh() {
  ssh "${GWADA_SSH[@]}" "$@"
}
