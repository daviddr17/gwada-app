# Gwada Staff — TestFlight Smoke-Checkliste (iPhone, LAN)

Nach Installation aus TestFlight, **gleiches WLAN** wie der Mac, Mac mit `pnpm db:start` + `pnpm dev`.

| # | Schritt | Erwartung | OK |
|---|---------|-----------|-----|
| 1 | App öffnen | Login-Screen | ☐ |
| 2 | `demo@gwada.app` + Passwort | Session aktiv | ☐ |
| 3 | Restaurant wählen | Tabs sichtbar | ☐ |
| 4 | Tische-Tab | Tischliste lädt | ☐ |
| 5 | Reservierungen-Tab | Monatsübersicht lädt | ☐ |
| 6 | Menü → Kasse (falls Berechtigung) | Stack-Navigation, Kassenstatus | ☐ |
| 7 | Tisch → Session → Bestellung | POS-Flow ohne Fehler | ☐ |

**Bei Verbindungsfehlern:** LAN-IP des Macs prüfen (`pnpm staff:env:lan`), EAS preview-Env aktualisieren, neu bauen.
