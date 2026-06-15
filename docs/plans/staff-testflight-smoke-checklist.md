# Gwada Staff — TestFlight Smoke-Checkliste

Kurzprüfung nach Installation aus **TestFlight** (Production-Build).

## Vor dem Test

| # | Check | OK |
|---|-------|-----|
| 0a | `pnpm staff:eas-env:production` vor letztem Build | ☐ |
| 0b | Live-Schema: Migration PIN + Mollie auf Production | ☐ |
| 0c | Fiskaly + Mollie für Ziel-Restaurant konfiguriert | ☐ |

## Smoke (ca. 10 Min)

| # | Schritt | Erwartung | OK |
|---|---------|-----------|-----|
| 1 | App öffnen | Login oder PIN-Unlock | ☐ |
| 2 | Restaurant wählen (Fadis oder Gwada Demo) | Tabs: Tische / Reservierungen / Bestellungen / Menü | ☐ |
| 3 | Tische-Tab | Tischliste lädt | ☐ |
| 4 | Reservierungen-Tab | Monatsübersicht lädt | ☐ |
| 5 | Menü → Kasse (falls Berechtigung) | Kassenstatus | ☐ |
| 6 | Tisch → Session → Neue Bestellung | Kategorien + Warenkorb | ☐ |
| 7 | Bar kassieren | Bezahlt + Beleg | ☐ |
| 8 | Karte oder PayPal (wenn Mollie verbunden) | Checkout + Bezahlt | ☐ |
| 9 | App 2 Min sperren, entsperren | PIN erforderlich | ☐ |

## Build-Referenz

| Feld | Wert |
|------|------|
| TestFlight Build-Nr. | |
| Git SHA (`/api/build-info`) | |
| Datum | |
| Tester | |

## Bei Verbindungsfehlern

- Production: API `https://new.gwada.app` — kein LAN nötig.
- LAN-Preview: Mac-IP in EAS preview-env (`pnpm staff:env:lan`).
