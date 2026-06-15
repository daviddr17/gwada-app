#!/usr/bin/env bash
# Gwada Staff — iOS Simulator mit Expo Go SDK 56
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAFF="$ROOT/apps/staff"
SIMULATOR_NAME="${GWADA_IOS_SIMULATOR:-iPhone 17 Pro}"
EXPO_PORT="${GWADA_EXPO_PORT:-8082}"
GO_TAR="https://github.com/expo/expo-go-releases/releases/download/Expo-Go-56.0.3/Expo-Go-56.0.3.tar.gz"
CACHE="/tmp/gwada-expo-go-56"

echo "→ Simulator booten: $SIMULATOR_NAME"
xcrun simctl boot "$SIMULATOR_NAME" 2>/dev/null || true
open -a Simulator

installed_version="$(xcrun simctl spawn booted defaults read host.exp.Exponent EXVersion 2>/dev/null || true)"
if [[ "${installed_version}" != 56.* ]]; then
  echo "→ Expo Go SDK 56 installieren (Simulator hat: ${installed_version:-keins})"
  mkdir -p "$CACHE"
  if [[ ! -f "$CACHE/Expo-Go-56.0.3.tar.gz" ]]; then
    echo "→ Lade Expo Go 56 (~77 MB) …"
    curl -L -o "$CACHE/Expo-Go-56.0.3.tar.gz" "$GO_TAR"
  fi

  EXTRACT_DIR="$CACHE/extracted"
  APP="$CACHE/Expo Go.app"
  rm -rf "$EXTRACT_DIR" "$APP"
  mkdir -p "$EXTRACT_DIR"
  tar -xzf "$CACHE/Expo-Go-56.0.3.tar.gz" -C "$EXTRACT_DIR"

  # GitHub-Release: flaches .app-Bundle (Info.plist im Root), kein Expo Go.app-Ordner
  if [[ -f "$EXTRACT_DIR/Info.plist" ]]; then
    mv "$EXTRACT_DIR" "$APP"
  else
    APP="$(find "$EXTRACT_DIR" -name 'Expo Go.app' -maxdepth 3 | head -1 || true)"
  fi

  if [[ -z "${APP:-}" || ! -d "$APP" ]]; then
    echo "Fehler: Expo Go.app nicht im Archiv gefunden." >&2
    exit 1
  fi
  xcrun simctl uninstall booted host.exp.Exponent 2>/dev/null || true
  xcrun simctl install booted "$APP"
  echo "→ Expo Go 56 installiert."
else
  echo "→ Expo Go $installed_version bereits im Simulator."
fi

if [[ ! -f "$STAFF/.env" ]]; then
  echo "Hinweis: $STAFF/.env fehlt — cp apps/staff/.env.example apps/staff/.env"
fi

echo "→ Staff-Env für Simulator (Port auto) …"
node "$ROOT/scripts/staff-simulator-env.mjs"

if [[ ! -f "$ROOT/apps/web/.env.local" && ! -f "$ROOT/.env.local" ]]; then
  echo "→ Web .env.local fehlt — sync aus supabase status …"
  node "$ROOT/scripts/sync-local-supabase-env.mjs" || true
fi

echo ""
echo "→ Starte Metro + öffne App (Port $EXPO_PORT)"
echo "  Web-API parallel: pnpm dev  (Port 3000, braucht .env.local → pnpm env:sync:local)"
echo "  Supabase:         pnpm db:start"
echo ""
cd "$STAFF"
exec npx expo start --ios -c --port "$EXPO_PORT"
