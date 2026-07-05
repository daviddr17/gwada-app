# Salvage-Audit: Loyaro → Gwada Staff App

> **Quell-Repo:** https://github.com/dmgitc/loyaro  
> **Relevante App:** `apps/employee` (Bonpilot Staff)  
> **Backend-Quelle:** `apps/api` (NestJS + Prisma) — **nicht** direkt übernehmen  
> **Datum:** 2026-06-07  
> **Entscheidung:** Neubau + Salvage (bestätigt)

---

## Repo-Überblick Loyaro

Loyaro ist ein **eigenständiges Monorepo** (pnpm + Turbo), Produktname **Bonpilot**:

| App | Zweck | Für Gwada |
|-----|-------|-----------|
| `apps/employee` | Kellner-App (Expo 54, RN 0.81) | **Referenz + API-Vertrag** |
| `apps/mobile` | Gäste-App + Loyalty | Später Phase 7 |
| `apps/api` | NestJS REST API, Mollie, Fiskaly, Orders | **Logik salvagen**, nicht deployen |
| `apps/admin` | Vite Admin | Nicht relevant (Gwada Web) |
| `packages/shared` | Loyalty/Wallet Types | Später für Gäste-App |
| `supabase/` | Auth + Realtime | Gwada hat eigenes Supabase |

**Architektur Loyaro:** Employee-App = dünner Client → NestJS `/api/v1/*` + Supabase nur für Auth/Realtime.

**Architektur Gwada (Ziel):** Employee-App = dünner Client → Next.js `/api/pos/*` + Supabase für Auth, Menu, Orders (RLS) + Server für Secrets.

---

## Kernbefund: Nicht die App übernehmen — Server-Logik salvagen

Die Kellner-App (`apps/employee`) ist bewusst **dünn** (~75 TS/TSX-Dateien). Die Komplexität sitzt in `apps/api`:

| Modul | Zeilen ca. | Tests | Salvage |
|-------|-----------|-------|---------|
| `fiskaly.service.ts` | 466 | ✅ spec | **REWRITE** nach Next.js, Logik 1:1 portieren |
| `payments.service.ts` | 534 | ✅ spec | **REWRITE** (Mollie OAuth → Gwada `platform_integrations`) |
| `payment-pipeline/` | ~8 Steps | ✅ 8 specs | **SALVAGE** Architektur + Step-Reihenfolge |
| `vat-calculator.service.ts` | 71 | — | **KEEP** (pure Funktion, nach TS portieren) |
| `fiskaly.step.ts` | 52 | ✅ spec | **KEEP** Semantik (non-fatal TSE failure) |
| `receipt.step.ts` | — | ✅ spec | **REWRITE** (Gwada Receipt-URLs) |
| `bill-split.service.ts` | — | ✅ spec | Phase 2 — **REFERENCE** |
| `order-builder.tsx` | 1112 | ❌ | **DISCARD** — UI-Neubau, Domain-Konzept übernehmen |
| `employee/src/api/*.ts` | ~12 Dateien | — | **REFERENCE** — API-Vertrag für Gwada |

---

## Salvage-Liste (KEEP / REWRITE / DISCARD)

### KEEP — direkt portierbar (Domain, keine UI)

| Artefakt | Quelle | Ziel Gwada | Anmerkung |
|----------|--------|------------|-----------|
| VAT-Berechnung SIGN DE / eReceipt | `apps/api/src/shared/vat/vat-calculator.service.ts` | `packages/pos-domain/vat.ts` | Prisma.Decimal → string/Decimal.js |
| Fiskaly SIGN DE Sequenz (ACTIVE → FINISHED) | `apps/api/src/modules/fiskaly/fiskaly.service.ts` | `apps/web/lib/pos/fiskaly-client.ts` | Auth-Token-Cache, tx_id = orderId |
| Payment-Pipeline Step-Reihenfolge | `payment-pipeline.service.ts` | `apps/web/lib/pos/payment-pipeline.ts` | Fiskaly → Receipt → Status → … |
| TSE non-fatal Policy | `fiskaly.step.ts` `fatal = false` | Pipeline-Config | KassenSichV §6a |
| Order-Status-Enum | `employee/src/types/index.ts` | `packages/pos-domain/order-status.ts` | an Gwada anpassen |
| Per-Unit Order-Konzept | `CONTEXT.md` „Order unit“ | `packages/pos-domain` + Docs | Konfigurierbare Produkte |
| API-Endpunkt-Vertrag | `employee/src/api/*.ts` | OpenAPI-intern / Types | Siehe Abschnitt API-Vertrag |

### REWRITE — als Spezifikation nutzen, neu implementieren

| Artefakt | Grund |
|----------|-------|
| Gesamte `apps/employee` UI | Gwada-Branding, kein NativeWind/Bonpilot-Theme |
| NestJS Controller/Services | Next.js Route Handlers + Supabase |
| Prisma Schema → Gwada Migrationen | `restaurant_id` statt `organizationId`, anderes Menu-Modell |
| Mollie OAuth pro Organisation | Gwada: `platform_integrations.config` + ggf. pro Restaurant |
| Realtime (Supabase Channel) | Neu auf Gwada-Tabellen, Channel-Namen ändern |
| `order-builder.tsx` Cart-Logik | 1112 Zeilen, an Loyaro Product-Modell gekoppelt — Konzept übernehmen, Code neu |
| Staff-PIN-Lock | Neu bauen, Flow aus Loyaro als Referenz |
| Kassen-Abschluss / DSFinV-K | Port Fiskaly-Admin-Logik, UI neu |

### DISCARD — nicht übernehmen

| Artefakt | Grund |
|----------|-------|
| `apps/api` NestJS Runtime | Anderer Stack; nur Logik extrahieren |
| `apps/admin`, `apps/marketing`, `apps/worker` | Nicht im Scope |
| Bonpilot-Branding, EAS Project ID, Bundle `de.loyaro.employee` | Neue Gwada-IDs |
| Loyaro Supabase-Instanz / Prisma DB | Gwada Supabase only |
| `socket.io-client` in Employee | Loyaro nutzt Supabase Realtime — in Gwada konsistent halten |
| Hardcoded Kategorien in `order-builder.tsx` | Gwada: dynamisch aus `menu_categories` |
| `@bonpilot/ui` workspace package | Gwada: eigenes RN UI Kit |

---

## API-Vertrag (Referenz aus `apps/employee/src/api/`)

Diese Endpunkte implementiert Gwada in `apps/web/app/api/pos/` (JWT via Supabase):

### Orders
| Method | Loyaro | Gwada (geplant) |
|--------|--------|-----------------|
| POST | `/orders` | `/api/pos/orders` |
| GET | `/orders/:id` | `/api/pos/orders/[id]` |
| GET | `/orders/session/:sessionId` | `/api/pos/orders/by-session/[sessionId]` |
| GET | `/orders/active?locationId=` | `/api/pos/orders/active?restaurantId=` |
| PATCH | `/orders/:id/status` | `/api/pos/orders/[id]/status` |
| POST | `/orders/:id/retry-signing` | `/api/pos/orders/[id]/retry-signing` |

### Payments
| Method | Loyaro | Gwada (geplant) |
|--------|--------|-----------------|
| POST | `/payments` | `/api/pos/payments` (Mollie) |
| PATCH | `/payments/:id/cash-received` | `/api/pos/payments/[id]/cash-received` |
| PATCH | `/payments/collect-cash/:orderId` | `/api/pos/payments/collect-cash/[orderId]` |
| POST | `/payments/recheck/:molliePaymentId` | `/api/pos/payments/recheck/[molliePaymentId]` |
| POST | `/payments/webhook` | `/api/pos/mollie/webhook` |

### Fiskaly / Kasse
| Method | Loyaro | Gwada (geplant) |
|--------|--------|-----------------|
| POST | `/fiskaly/register/open` | `/api/pos/fiskaly/register/open` |
| POST | `/fiskaly/register/close` | `/api/pos/fiskaly/register/close` |
| GET | `/fiskaly/closings/preview` | `/api/pos/fiskaly/closings/preview` |
| POST | `/fiskaly/closings` | `/api/pos/fiskaly/closings` |

### Tables / Sessions
| Method | Loyaro | Gwada (geplant) |
|--------|--------|-----------------|
| — | `tableSessions`, `tables` API | Supabase direkt + `/api/pos/table-sessions` |

---

## Datenmodell: Loyaro vs. Gwada (Lücken)

| Loyaro (Prisma) | Gwada (heute) | Aktion |
|-----------------|---------------|--------|
| `Organization` + `Location` | `restaurants` | 1 Restaurant = 1 Standort initially |
| `Product` + VAT + Extras + Sides | `menu_items` (kein VAT, keine Extras) | **Migration:** `vat_rate`, Modifiers-Tabellen |
| `Table` + `TableSession` | `dining_tables` (kein Session) | **Migration:** `table_sessions` |
| `Order` + `OrderItem` + `Payment` | entfernt (20260530) | **Migration:** neu designen (siehe Plan) |
| `FiskalyTransaction` | fehlt | **Migration** |
| `FiskalyConfig` pro Org | fehlt | **Migration** + `platform_integrations` |
| `Staff` + PIN | `restaurant_staff` / employees | Mapping prüfen |
| `BillSplitAssignment` | fehlt | Phase 2 (Split Bill) |

---

## Mollie & Fiskaly — Salvage-Details

### Mollie (Loyaro)
- Methoden: `cash`, `card`, `paypal`, `terminal`
- OAuth pro Organisation (`mollie-oauth` Modul) + Terminal ID
- Webhook → Status-Update → Payment Pipeline
- Lokal: Cash only (Webhook unreachable) — **dokumentiert in RUNNING_AND_DEPLOYING.md**

### Gwada-Anpassung
- Secrets in `platform_integrations.config` (Superadmin)
- Webhook: `https://gwada.app/api/pos/mollie/webhook`
- Pro Restaurant oder plattformweit — **Entscheidung offen** (empfohlen: pro Restaurant in `restaurant_integrations`)

### Fiskaly (Loyaro)
- SIGN DE v2: TSS + Client pro Location
- Deterministische `tx_id = order.id` (idempotent retry)
- eReceipt best-effort (non-fatal)
- Daily Closing + DSFinV-K Export
- Reconciliation UI in Employee App (`fiskaly-reconciliation.tsx`)

### Gwada-Anpassung
- TSS/Client pro `restaurant_id` (statt Location)
- Fiskaly TEST lokal, LIVE auf Production
- Port `fiskaly.service.ts` + `fiskaly-admin.service.ts` Logik

---

## Mollie-Strategie (Entscheidungshilfe)

Gwada hat bereits **`restaurant_integrations`** (E-Mail, Facebook, …) und **`platform_integrations`** (Superadmin). Mollie für POS passt am ehesten zu **Restaurant-Ebene** — Geld fließt zum Gastronomen, nicht zur Plattform.

### Option A — Pro Restaurant (Loyaro-Vorbild)

Jedes Restaurant verbindet **eigenes Mollie-Konto** per OAuth unter Einstellungen → Integrationen.

| Pro | Contra |
|-----|--------|
| Zahlungen landen direkt beim Restaurant (Merchant of Record) | Mehr Setup pro Mandant |
| Passt zu Multi-Tenant / später viele Restaurants | OAuth-Flow + Token-Refresh bauen |
| Terminal-ID pro Restaurant möglich | Jedes Restaurant braucht Mollie-Account |
| Entspricht `restaurant_integrations`-Muster | |
| Kein Auszahlungs-/Treuhand-Thema für Gwada | |

**Technik:** `restaurant_integrations.key = 'mollie'`, verschlüsselte Tokens in `config`, Webhook ein Endpoint → Routing per `restaurant_id` in Payment-Metadata.

### Option B — Plattformweit (ein Gwada-Mollie-Konto)

Alle POS-Zahlungen über **einen** API-Key in `platform_integrations`.

| Pro | Contra |
|-----|--------|
| Schnellster MVP (ein Test-Key) | Gwada ist Merchant — Auszahlung an Restaurants nötig |
| Kein OAuth pro Restaurant | Terminal-Zuordnung unklar bei mehreren Betrieben |
| Einfacher Webhook | Rechtlich/steuerlich heikel bei fremden Umsätzen |
| | Skaliert schlecht über Demo-Restaurant hinaus |

### Option C — Hybrid (Empfehlung für Umsetzung)

| Ebene | Rolle |
|-------|--------|
| **Architektur-Ziel** | Option A — pro Restaurant |
| **MVP-Bootstrap** | Plattform-`test_`-Key als **Fallback**, wenn Restaurant noch nicht verbunden (Loyaro macht das in `mollie-oauth.service.ts`) |
| **Barzahlung** | Kein Mollie nötig — MVP kann mit Cash + Fiskaly starten |
| **Phase 2** | Mollie OAuth UI in Restaurant-Einstellungen |

```text
Payment anlegen
  → restaurant_integrations.mollie vorhanden?  → OAuth-Token
  → sonst (nur Dev/MVP)                        → platform_integrations Fallback
  → sonst                                      → Fehler „Mollie nicht konfiguriert“
```

**Entscheidung (bestätigt): Option C (Hybrid)**

- Zielbild: Mollie OAuth pro Restaurant in `restaurant_integrations` (`key = 'mollie'`)
- Dev/MVP-Fallback: Plattform-Test-Key in `platform_integrations`, wenn Restaurant noch nicht verbunden
- Staff v1: Barzahlung + Fiskaly **ohne** Mollie; Karte/PayPal/Terminal in Phase 2
- Webhook: ein Endpoint `/api/pos/mollie/webhook`, Routing per `restaurant_id` in Payment-Metadata

---

## Employee-App Screens (Referenz für Gwada-Neubau)

| Screen | Datei | MVP? |
|--------|-------|------|
| Login | `login.tsx` | ✅ |
| Location Select | `location-select.tsx` | → Workspace-Restaurant (vereinfachen) |
| Tische | `(tabs)/tables.tsx` | ✅ |
| Bestellung | `order-builder.tsx` | ✅ (ohne Extras initially wenn Schema fehlt) |
| Bestelldetail | `orders/[id].tsx` | ✅ |
| Barzahlung | `orders/[id]/cash.tsx` | ✅ |
| Kartenzahlung | `card-payment.tsx`, `terminal-payment.tsx` | Phase 2 |
| PayPal QR | `paypal-qr.tsx` | Phase 2 |
| Split Bill | `split-bill.tsx` | Phase 2 |
| Zahlungen-Tab | `(tabs)/zahlungen.tsx` | Phase 2 |
| Reservierungen | `(tabs)/reservations.tsx` | Optional (Gwada Web hat Floor Plan) |
| Queue/KDS | `(tabs)/queue.tsx` | Phase 2 |
| Kasse/Abschluss | `kasse/*` | Phase 2 |
| Fiskaly Reconciliation | `fiskaly-reconciliation.tsx` | Phase 2 |
| PIN Lock | `pin.tsx`, `PinLockScreen` | Phase 2 |
| Einstellungen | `(tabs)/einstellungen.tsx` | ✅ minimal |

---

## Tech-Stack Employee-App (Referenz)

| | Loyaro | Gwada Staff (Ziel) |
|---|--------|-------------------|
| Expo SDK | 54 | 54 (oder aktuell LTS bei Start) |
| React Native | 0.81.5 | gleich |
| Router | expo-router 6 | expo-router |
| State | zustand + tanstack query | gleich |
| Styling | NativeWind 4 | **Neu:** Gwada Design Tokens (kein Bonpilot-Grün) |
| Auth Storage | expo-secure-store | gleich |
| Bundle ID | `de.loyaro.employee` | **neu** z. B. `app.gwada.staff` |
| EAS Project | `032c24eb-…` | **neu** (eigenes Expo-Projekt) |

---

## Bugs / Risiken im Quell-Repo

| Fund | Schwere | Konsequenz für Gwada |
|------|---------|---------------------|
| Wenige TODOs in Employee-App | niedrig | Kein Bug-Erbe in UI |
| Fiskaly Admin TODO slot-signing | mittel | Split-Bill TSE bewusst in Phase 2 |
| Loyaro: NestJS + Prisma + Supabase (3 Stores) | hoch | Gwada vereinfachen: Supabase + Next API |
| `order-builder` 1112 Zeilen, keine Tests | hoch | **Nicht portieren** |
| Gwada `menu_items` ohne VAT/Extras | hoch | Schema vor POS-MVP erweitern |
| Mollie Webhook lokal broken | bekannt | Cash-first für lokale Dev (wie Loyaro) |

---

## MVP-Empfehlung (Gwada Staff v1)

**In Scope v1:**
1. Login (Supabase, Staff-Rolle)
2. Tische + Table Session
3. Speisekarte aus `menu_items` (einfache Positionen, ohne Extras)
4. Bestellung anlegen
5. Barzahlung + Fiskaly-Signatur
6. Gwada UI/Branding

**Phase 2:**
- Mollie (Karte, PayPal, Terminal)
- Split Bill
- Kassenabschluss / DSFinV-K
- PIN-Lock, Loyalty-Scanner
- KDS/Queue

**Phase 3 (separate App):**
- `apps/guest` — Loyalty aus `apps/mobile` Loyaro als Referenz

---

## Nächster Schritt

Phase 1 Monorepo-Scaffold (`apps/web` move) — siehe `expo-staff-app-integration.md`.
