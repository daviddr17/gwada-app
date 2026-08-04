#!/bin/zsh
set -euo pipefail
cd /Users/fadihanna/Documents/GitHub/gwada-app/apps/pos

echo "==> Simulator starten…"
open -a Simulator || open /Applications/Xcode.app/Contents/Developer/Applications/Simulator.app
sleep 5

SIM=$(xcrun simctl list devices booted | awk -F'[()]' '/iPhone/{print $2; exit}')
if [[ -z "${SIM:-}" ]]; then
  SIM=$(xcrun simctl list devices available | awk -F'[()]' '/iPhone 17 \(/ {print $2; exit}')
  echo "==> Boot $SIM"
  xcrun simctl boot "$SIM" || true
fi
echo "==> Gerät: $SIM"
xcrun simctl bootstatus "$SIM" -b

echo "==> Build GwadaPOS…"
xcodegen generate >/dev/null 2>&1 || true
xcodebuild -scheme GwadaPOS -destination "id=$SIM" -derivedDataPath /tmp/gwada-pos-morning -configuration Debug build
APP=/tmp/gwada-pos-morning/Build/Products/Debug-iphonesimulator/GwadaPOS.app

echo "==> Install + Launch…"
xcrun simctl terminate "$SIM" app.gwada.pos 2>/dev/null || true
xcrun simctl install "$SIM" "$APP"
xcrun simctl launch "$SIM" app.gwada.pos

echo ""
echo "✓ GwadaPOS läuft auf dem Simulator."
echo "Fenster kann geschlossen werden."
sleep 3
