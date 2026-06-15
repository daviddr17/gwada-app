# Gwada Staff — E2E-Testprotokoll (Produktionsreife / TestFlight)

> **Ziel:** Kern-POS (Bar + Mollie), Fiskaly TSE, PDF-Beleg, PIN-Lock — abnahmereif für internes TestFlight.  
> **Restaurants:** Fadis BurgerStation + Gwada Demo (jeweils LAN und Live).

---

## Voraussetzungen

| Dienst | Befehl | Prüfung |
|--------|--------|---------|
| Supabase lokal | `pnpm db:start` | Studio: http://127.0.0.1:54323 |
| Schema aktuell | `pnpm db:push:local` | Migration `20260610180000_staff_app_pin_and_mollie_integration.sql` |
| Web-API | `pnpm dev` (Root) | http://localhost:3000 |
| Staff LAN | `pnpm staff:env:lan` + Expo | `EXPO_PUBLIC_GWADA_API_URL` = Mac-LAN-IP |
| Staff Live | TestFlight `production` | `https://new.gwada.app` |
| Fiskaly | Superadmin → Integrationen → Fiskaly | TEST-Keys, Restaurants `ready` |
| Mollie | Superadmin → Mollie aktiv + OAuth-Credentials | Restaurant → Integrationen → Mollie verbinden (Testmodus) |

**Tabs in der Staff-App:** Tische · Reservierungen · Bestellungen · **Menü** (nicht „Einstellungen“).

---

## Testfälle

### TC-01 Login, PIN & Restaurant

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | App öffnen (nach Login) | PIN festlegen (4 Ziffern) beim ersten Start |
| 2 | PIN bestätigen | Tabs sichtbar |
| 3 | App in Hintergrund, wieder öffnen | PIN-Eingabe (Unlock) |
| 4 | Restaurant wählen | Tabs: Tische / Reservierungen / Bestellungen / Menü |
| 5 | 5× falscher PIN | Abmelden |

**Status LAN:** ☐ Fadis ☐ Gwada Demo — **Live:** ☐ Fadis ☐ Gwada Demo — Notiz: _______________

---

### TC-02 Tisch → Bestellung anlegen

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Tab **Tische** | Bereichs-Chips, Tische mit Status |
| 2 | Freien Tisch → Session starten → **Neue Bestellung** | Kategorie-Chips, Warenkorb-Leiste |
| 3 | Gerichte wählen, **Bestellung senden** | Bestelldetail, Status offen |
| 4 | Tab **Bestellungen → Offen** | Bestellung sichtbar |

**Status LAN:** ☐ Fadis ☐ Gwada Demo — **Live:** ☐ Fadis ☐ Gwada Demo — Notiz: _______________

---

### TC-02c Session Split & Freigabe

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Mehrere Bestellungen an einem Tisch | Session-Hub |
| 2 | Positionen wählen, **Bar kassieren** | Teilzahlung |
| 3 | Rest kassieren, **Tisch freigeben** | Tisch **Frei** |
| 4 | Freigabe mit offenen Positionen | `session_has_open_lines` |

**Status LAN:** ☐ Fadis ☐ Gwada Demo — **Live:** ☐ Fadis ☐ Gwada Demo — Notiz: _______________

---

### TC-03 Barzahlung + TSE

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Bestelldetail → **Rest bar bezahlen** | `paymentState: paid` |
| 2 | Fiskaly | `fiscalState: signed` oder Retry |
| 3 | Tab **Bezahlt (heute)** | Bestellung sichtbar |

**Status LAN:** ☐ Fadis ☐ Gwada Demo — **Live:** ☐ Fadis ☐ Gwada Demo — Notiz: _______________

---

### TC-04 PDF-Beleg

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | **Beleg anzeigen** | Thermales PDF (kein Fiskaly-Webview) |
| 2 | **Teilen** | iOS Share-Sheet |

**Status LAN:** ☐ Fadis ☐ Gwada Demo — **Live:** ☐ Fadis ☐ Gwada Demo — Notiz: _______________

---

### TC-05 Kassenöffnung / -schließung (Web)

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Web → Einstellungen → Kasse | Fiskal-Übersicht |
| 2 | Kasse öffnen / schließen (Z-Bon) | Erfolg &lt; 10 s |

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________

---

### TC-06 TSE-Retry (Fehlerfall)

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Order mit `fiscalState: failed` (oder Netz kurz trennen) | Retry sichtbar |
| 2 | **TSE erneut signieren** | `signed`, Beleg regeneriert |

**Status LAN:** ☐ Fadis ☐ Gwada Demo — **Live:** ☐ Fadis ☐ Gwada Demo — Notiz: _______________

---

### TC-07 DSFinV-K ZIP (Staff)

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Nach Z-Bon | Export bei Fiskaly `COMPLETED` |
| 2 | Menü → **Kasse** → **ZIP teilen** | Share-Sheet, `dsfinvk-YYYY-MM-DD.zip` |

**Vorprüfung:** `node scripts/verify-dsfinvk-session-export.mjs`

**Status LAN:** ☐ Fadis ☐ Gwada Demo — **Live:** ☐ Fadis ☐ Gwada Demo — Notiz: _______________

---

### TC-08 Mollie (Karte + PayPal)

| Schritt | Aktion | Erwartung |
|---------|--------|-----------|
| 1 | Mollie im Web verbunden (Testmodus) | Staff zeigt **Karte** / **PayPal** |
| 2 | Bestelldetail → **Mit Karte bezahlen** | Mollie-Checkout (WebView), danach `paid` + TSE |
| 3 | Session-Split → **PayPal** | Zahlung unter Tab **Zahlungen**, Beleg |
| 4 | Ohne Mollie-Verbindung | Klare Meldung `mollie_not_configured` |
| 5 | Webhook | `POST /api/pos/mollie/webhook` auf Live-Domain |

**Hinweis:** Mollie-Webhooks brauchen **öffentliche URL** — Live/TestFlight, nicht localhost.

**Status LAN:** ☐ (optional) — **Live:** ☐ Fadis ☐ Gwada Demo — Notiz: _______________

---

## Automatisierte Vorprüfung

```bash
pnpm --filter staff exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
node scripts/test-dsfinvk-runtime-export.mjs
node scripts/verify-dsfinvk-session-export.mjs
```

---

## Ergebnis-Log

| Datum | Tester | Umgebung | Restaurant | TC-01 | TC-02 | TC-03 | TC-04 | TC-05 | TC-06 | TC-07 | TC-08 |
|-------|--------|---------|------------|-------|-------|-------|-------|-------|-------|-------|-------|
| | | LAN / Live | Fadis / Gwada | | | | | | | | |

---

## Session-Timeout (manuell, Stichprobe)

| Schritt | Erwartung |
|---------|-----------|
| 15 Min ohne App-Nutzung (oder Timer verkürzt zum Test) | PIN-Unlock, Session-Daten erhalten |
| Offene Tisch-Session nach Timeout | Kein Datenverlust, nur PIN |

**Status:** ☐ bestanden ☐ fehlgeschlagen — Notiz: _______________
