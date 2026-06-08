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
| 1 | Tab **Tische** | Liste aktiver Tische (Skeleton nur bei >120ms Ladezeit) |
| 2 | Tisch tippen | Session geöffnet → Screen „Neue Bestellung“ |
| 3 | Gerichte wählen, **Bestellung senden** | Redirect zu Bestelldetail, Status `open` / `submitted` |
| 4 | Tab **Bestellungen → Offen** | Bestellung sichtbar |

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
| 5 | Terminal-Log | `POST …/register/close` ohne 12-s-Blockade durch ZIP-Export |

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________

---

### TC-07 DSFinV-K ZIP — Download & Teilen (Staff)

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Nach TC-05 (Z-Bon) | Fiskaly-Export typisch nach wenigen Sekunden `COMPLETED` (kein Server-Cache) |
| 2 | Staff → Kasse | Geschlossene Sitzung: Button **„ZIP teilen“** sichtbar |
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

## Bekannte Lücken (noch nicht in diesem Protokoll)

- **Mollie-Zahlung** — Phase 4 Restarbeit (bewusst nach Cash+MVP)
- **Magic-Link-Login** — Staff nutzt aktuell Passwort
- **TestFlight** — Apple Team ID + Bundle ID noch offen

---

## Ergebnis-Log

| Datum | Tester | TC-01 | TC-02 | TC-03 | TC-04 | TC-05 | TC-06 | TC-07 |
|-------|--------|-------|-------|-------|-------|-------|-------|-------|
| | | | | | | | | |
