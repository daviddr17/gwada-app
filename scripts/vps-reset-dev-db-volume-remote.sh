#!/usr/bin/env bash
# Dev-Postgres komplett zurücksetzen — delegiert an Provision (neue .env + Volumes).
set -euo pipefail

compose_dir="${1:-/opt/gwada-supabase-dev}"
provision_script="/tmp/vps-provision-dev-supabase.sh"
if [[ ! -f "${provision_script}" ]]; then
  provision_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/vps-provision-dev-supabase.sh"
fi

export GWADA_DEV_SUPABASE_DIR="${compose_dir}"
export GWADA_DEV_FORCE_VOLUME_RESET=1

exec bash "${provision_script}"
