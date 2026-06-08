# Gwada Staff — TestFlight-Vorbereitung

> **Branch:** `plan/expo-iphone-integration`  
> **Bundle ID:** `app.gwada.staff` (siehe [`apps/staff/app.config.ts`](../../apps/staff/app.config.ts))

## Voraussetzungen (Apple)

| Punkt | Status | Notiz |
|-------|--------|-------|
| Apple Developer Program | offen | Team ID für Signing |
| App ID `app.gwada.staff` | offen | In Apple Developer anlegen |
| Provisioning Profile | offen | Nach App ID |

## Lokaler Dev Client (vor TestFlight)

Simulator mit Expo Go (schnell):

```bash
pnpm run dev:staff:ios
# oder: ./scripts/staff-ios-simulator.sh
```

Nativer Dev Client (näher an TestFlight):

```bash
cd apps/staff
npx expo run:ios
```

Voraussetzungen: Xcode, CocoaPods, iOS Simulator oder angeschlossenes Gerät.

## EAS Build (optional, empfohlen für TestFlight)

1. `npm i -g eas-cli` (oder `pnpm dlx eas-cli`)
2. In `apps/staff`: `eas login`
3. `eas build:configure` (einmalig)
4. `eas build --platform ios --profile preview`
5. `eas submit --platform ios` nach erfolgreichem Build

`eas.json` ist noch nicht im Repo — bei erstem TestFlight-Lauf anlegen.

## API-URL für Geräte außerhalb localhost

| Umgebung | `EXPO_PUBLIC_GWADA_API_URL` |
|----------|----------------------------|
| Simulator (Mac) | `http://127.0.0.1:3000` oder LAN-IP des Macs |
| Physisches iPhone (dev) | `http://<mac-lan-ip>:3000` |
| TestFlight / Staging | `https://new.gwada.app` |

Env generieren: `node apps/staff/scripts/generate-staff-env.js`

## Checkliste vor erstem TestFlight-Upload

- [ ] E2E-Protokoll [`staff-app-e2e-test-protocol.md`](./staff-app-e2e-test-protocol.md) vollständig (inkl. TC-06)
- [ ] App-Icon und Splash final ([`apps/staff/assets/images/`](../../apps/staff/assets/images/))
- [ ] Bundle ID in Apple Developer registriert
- [ ] Production-API-URL in EAS-Secrets / Build-Env
- [ ] Fiskaly LIVE nur wenn bewusst gewünscht (aktuell TEST)

## Nach TestFlight

- Mollie-Integration (Webhook auf `new.gwada.app`) — siehe [`expo-staff-app-integration.md`](./expo-staff-app-integration.md)
