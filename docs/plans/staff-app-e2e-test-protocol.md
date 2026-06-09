# Gwada Staff — E2E-Testprotokoll (Phase 6)

> **Branch:** `plan/expo-iphone-integration`  
> **Ziel:** Cash-POS + Fiskaly TSE + PDF-Beleg lokal durchspielen, bevor TestFlight / Mollie.

---

## Voraussetzungen

| Dienst | Befehl | Prüfung |
|--------|--------|---------|
| Supabase lokal | `pnpm db:start` | Studio: http://127.0.0.1:54323 |
| Schema aktuell | `pnpm db:push:local` | Keine ausstehenden Migrationen |
| Demo-Daten | `pnpm db:seed` (falls nötig) | User `demo@gwada.app`, Restaurant gwada-demo |
| Tischplan | `pnpm db:seed:dining-floor` | Mind. 1 aktiver Tisch |
| Web-API | `pnpm dev` (Root) | http://localhost:3000 |
| Staff-Env | `cp apps/staff/.env.example apps/staff/.env` + `node apps/staff/scripts/generate-staff-env.js` | `EXPO_PUBLIC_GWADA_API_URL=http://localhost:3000` |
| Fiskaly TEST | Superadmin → Integrationen → Fiskaly | `api_key_configured` + `api_secret_configured` |
| Restaurant-Fiskal | Einstellungen → Kasse | TSS provisioniert, Kasse geöffnet |

**Simulator starten:** `./scripts/staff-ios-simulator.sh` (Expo Go SDK 56 + Metro)

---

## Testfälle

### TC-01 Login & Restaurant

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | App öffnen | Login-Screen |
| 2 | `demo@gwada.app` + Passwort | Session aktiv |
| 3 | Restaurant wählen (gwada-demo) | Tabs: Tische / Bestellungen / Einstellungen |

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________

---

### TC-02 Tisch → Bestellung anlegen

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Tab **Tische** | Bereichs-Chips, Tische mit Kapazität + Status (Frei/Besetzt) |
| 2 | Freien Tisch tippen (Kasse offen) | Sheet **Personen am Tisch** → Session starten → „Neue Bestellung“ |
| 3 | Gerichte wählen, **Bestellung senden** | Redirect zu Bestelldetail, Status `open` / `submitted` |
| 4 | Tab **Bestellungen → Offen** | Bestellung sichtbar |
| 5 | Besetzten Tisch erneut tippen | **Tisch-Session**-Hub: Personen, Bestellliste, „Neue Bestellung“ |

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________

---

### TC-02c Session Split & Freigabe

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | 3 Bestellungen an einem Tisch (Getränke, Hauptgang, Dessert) | Session-Hub zeigt alle Bestellungen |
| 2 | Einzelne Positionen/Mengen wählen, **Bar kassieren** | Teilzahlung, offener Rest bleibt sichtbar |
| 3 | Restliche Positionen kassieren | `canReleaseTable`, **Tisch freigeben** aktiv |
| 4 | **Tisch freigeben** | Session `closed`, Tisch in Liste **Frei** |
| 5 | Freigabe vor vollständiger Zahlung versuchen | Fehler `session_has_open_lines` |
| 6 | Bereichs-Chip „Innenraum“ | Text vollständig lesbar (kein Clipping links) |

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________

---

### TC-02b Kassen-Gate vor neuer Tisch-Session

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Kasse schließen (Tab **Kasse** oder Web) | `register-status`: `isOpen: false` |
| 2 | Freien Tisch tippen (User **ohne** `pos.kasse.manage`) | Alert „Kasse geschlossen“, **keine** neue `pos_table_sessions`-Zeile |
| 3 | Mit `pos.kasse.manage`: freien Tisch tippen | Sheet **Kasse öffnen** mit Soll-Bar-Vorschlag → Personen → Session + Bestellung |
| 4 | Kasse geschlossen, Bestellung senden (bestehende Session) | API-Fehler `register_closed` |

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________

---

### TC-03 Barzahlung + TSE

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Bestelldetail öffnen | Summe, Positionen, **Bar kassieren** |
| 2 | Barzahlung bestätigen | `paymentState: paid`, Order `delivered` |
| 3 | Fiskaly-Block | `fiscalState: signed` (oder Retry-Button bei Fehler) |
| 4 | Tab **Bezahlt (heute)** | Bestellung erscheint |

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________

---

### TC-04 PDF-Beleg (nicht Fiskaly-Webseite)

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | **Beleg anzeigen** (Detail oder Bezahlt-Liste) | Thermales PDF (Loyaro-Layout), kein Fiskaly-eReceipt-Webview |
| 2 | **Teilen** | PDF teilbar |
| 3 | Supabase Storage | Bucket `pos-receipts`: `{restaurantId}/{orderId}.pdf` |
| 4 | DB `pos_orders` | `receipt_url` = Storage-Pfad (kein HTTP) |

**Hinweis:** Nach API-Codeänderungen `pnpm dev` neu starten.

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________

---

### TC-05 Kassenöffnung / -schließung (Web)

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Web → Einstellungen → Kasse | Fiskal-Übersicht |
| 2 | Kasse öffnen (Anfangsbestand) | Register-Session `open` |
| 3 | Zahlung TC-03 | TSE-Signatur erfolgreich |
| 4 | Kasse schließen (Z-Bon, Endbestand) | Antwort **&lt; 10 s**, Erfolg-Toast; **kein** Timeout-Fehler |
| 5 | Terminal-Log | `POST …/register/close` antwortet schnell (kein serverseitiger ZIP-Upload) |

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________

---

### TC-07 DSFinV-K ZIP — Download & Teilen (Staff)

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Nach TC-05 (Z-Bon) | Fiskaly-Export typisch nach wenigen Sekunden `COMPLETED` (kein Server-Cache) |
| 2 | Staff → Tab **Kasse** | Geschlossene Sitzung: Button **„ZIP teilen“** sichtbar |
| 3 | **ZIP teilen** tippen | Ladevorgang (einige Sekunden), dann iOS Share-Sheet, Dateiname `dsfinvk-YYYY-MM-DD.zip` |
| 4 | Terminal-Log | `GET …/register/sessions/{id}/dsfinvk-download` → **200**, `Content-Type: application/zip`, Header `X-Dsfinvk-Source` |
| 5 | DB / Storage | **Kein** `dsfinvk_export_storage_path`, **keine** ZIP in `pos-receipts` (Runtime-only) |
| 6 | Optional: ZIP entpacken | DSFinV-K-Struktur (nicht leer / kein HTML-Fehlerbody) |

**Vorprüfung (lokal):** `node scripts/verify-dsfinvk-session-export.mjs`

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________

---

### TC-06 TSE-Retry (Fehlerfall)

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Order mit `fiscalState: failed` simulieren (oder Netzwerk kurz trennen) | Retry-Button sichtbar |
| 2 | **TSE erneut signieren** | `signed`, Beleg regeneriert |

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________

---

## Automatisierte Vorprüfung (Agent/CI)

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter staff exec tsc --noEmit
node scripts/test-dsfinvk-runtime-export.mjs
node scripts/verify-dsfinvk-session-export.mjs
```

## Bekannte Lücken (noch nicht in diesem Protokoll)

- **Mollie-Zahlung** — nach TestFlight/Staging-Domain (Webhook braucht öffentliche URL, localhost ungeeignet)
- **Magic-Link-Login** — Staff nutzt aktuell Passwort
- **TestFlight** — Apple Team ID + Bundle ID noch offen

---

## Ergebnis-Log

| Datum | Tester | TC-01 | TC-02 | TC-03 | TC-04 | TC-05 | TC-06 | TC-07 |
|-------|--------|-------|-------|-------|-------|-------|-------|-------|
| 2026-06-08 | Nutzer + Agent | ✓ | ✓ | ✓ | ✓ | ✓ | offen | ✓ (Runtime-Script + Share) |
