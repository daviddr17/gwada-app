#!/usr/bin/env bash
# Gemeinsame Image-Konstanten (CI, VPS, lokal).
GWADA_LIVE_APP_REGISTRY="${GWADA_LIVE_APP_REGISTRY:-ghcr.io}"
GWADA_LIVE_APP_IMAGE_REPO="${GWADA_LIVE_APP_IMAGE_REPO:-ghcr.io/daviddr17/gwada-app}"

live_app_image_for_sha() {
  local sha="$1"
  echo "${GWADA_LIVE_APP_IMAGE_REPO}:${sha}"
}
