# Gwada Staff — internes TestFlight Sign-off

> Checkliste für **1 Tag Realbetrieb** je Restaurant vor internem Go-Live.

## Restaurants

| Restaurant | Realbetrieb-Datum | Tester | Sign-off |
|------------|-------------------|--------|----------|
| Fadis BurgerStation | | | ☐ |
| Gwada Demo | | | ☐ |

## Tagesablauf (je Restaurant)

| Phase | Aktion | OK |
|-------|--------|-----|
| Morgens | Kasse öffnen (Web), PIN-Unlock Staff | ☐ |
| Service | Tisch → Bestellung → Bar + mind. 1× Mollie | ☐ |
| Service | Session-Split, Tisch freigeben | ☐ |
| Abends | Kasse schließen (Z-Bon), DSFinV-K ZIP teilen (Stichprobe) | ☐ |

## Go-Live-Kriterien (intern)

| Kriterium | Status |
|-----------|--------|
| E2E TC-01–TC-07 grün (Live, beide Restaurants) | ☐ |
| TC-08 Mollie grün (Live) | ☐ |
| PIN-Lock + 15-Min-Timeout aktiv | ☐ |
| Security-Review ohne rote Blocker ([`staff-app-security-review.md`](./staff-app-security-review.md)) | ☐ |
| Keine P0-Bugs im Kern-Flow | ☐ |
| TestFlight-Build dokumentiert ([`staff-testflight-smoke-checklist.md`](./staff-testflight-smoke-checklist.md)) | ☐ |

## Build & Deploy (nur mit ausdrücklicher Freigabe)

```bash
# Production-Env für EAS
pnpm staff:eas-env:production

# Native-Änderungen: neuer TestFlight-Build
# Nur JS/TS: OTA-Update (Expo Updates)
```

| Schritt | Befehl / Aktion | Erledigt |
|---------|-----------------|----------|
| Schema Live | `deploy-live-db` Workflow nach Push | ☐ |
| App Live | Push `main` → `deploy-live-app` | ☐ |
| TestFlight | EAS Submit / internes Team | ☐ |
| Verifikation | `curl -s https://new.gwada.app/api/build-info` | ☐ |

## Freigabe

| Rolle | Name | Datum | Unterschrift / OK |
|-------|------|-------|-------------------|
| Entwicklung | | | ☐ |
| Betrieb | | | ☐ |
