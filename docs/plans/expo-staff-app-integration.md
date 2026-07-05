# Gwada Staff App (Expo) — Integrationsplan

> **Branch:** `plan/expo-iphone-integration`  
> **Strategie:** A — Monorepo (`apps/web`, `apps/staff`, `packages/*`)  
> **Ziel-PR:** gegen `main` (Teamkollege arbeitet auf `develop`, pusht regelmäßig auf `main`)  
> **Stand:** Phase 4–5 MVP (Cash + Fiskaly + PDF-Beleg) implementiert — Phase 6 (E2E / Release) läuft

---

## Entscheidung: Übernahme vs. Neubau

### Empfehlung: **Neubau mit gezielter Übernahme** (Greenfield + Salvage-Audit)

**Nicht** die bestehende Expo-App als Ganzes übernehmen und „nur UI + Backend tauschen“.

| Kriterium | Übernahme | Neubau + Salvage | Gewicht |
|-----------|-----------|------------------|---------|
| UI wird ohnehin neu | neutral | ✅ passt | hoch |
| Gwada-Supabase ≠ altes Backend | ❌ viel Anpassung | ✅ von Anfang an richtig | hoch |
| Bug-Vermeidung (explizites Ziel) | ❌ erbt Altlasten | ✅ sauberer Start | hoch |
| Mollie/Fiskaly serverseitig (Gwada-Regel) | ❌ Client-Code oft wertlos | ✅ neu in `apps/web` API | hoch |
| POS-Schema in Gwada | ❌ `orders`/`order_items` wurden entfernt | ✅ neues Schema bewusst designen | hoch |
| Zeitersparnis komplexe Integrationen | ✅ wenn Code sauber | ⚠️ nur isolierte Module | mittel |

### Was aus dem Expo-Repo **nicht** übernommen wird

- Screens, Navigation, Styling, Komponenten (UI-Neubau „Gwada Staff“)
- Datenzugriff auf altes Backend / eigene Tabellen
- Client-seitige Mollie- oder Fiskaly-Aufrufe (Secrets gehören serverseitig)
- Globaler App-State, der an altes Datenmodell gekoppelt ist
- Ungetestete oder undokumentierte Workarounds

### Was aus dem Expo-Repo **nach Audit** übernommen werden kann

Nur nach explizitem Review (Salvage-Liste pro Datei/Modul):

| Modul | Kriterium für Übernahme | Ziel im Monorepo |
|-------|------------------------|------------------|
| Fiskaly-Request-Sequenzen | Isoliert, ohne UI-Kopplung | `packages/pos-domain` + `apps/web/app/api/pos/fiskaly/` |
| Mollie-Flow (Intent → Webhook → Status) | Als reine Domain-Logik extrahierbar | `packages/pos-domain` + Server-API |
| Bestell-State-Machine | Rein, getestet, zustandslos | `packages/pos-domain` |
| Steuer-/Rundungslogik | Unit-Tests vorhanden | `packages/pos-domain` |
| Expo/EAS-Konfiguration | Bundle ID, iOS-Settings | Referenz für `apps/staff/app.config.ts` |

**Salvage-Audit (Phase 0):** Quell-Repo Datei für Datei taggen: `KEEP` / `REWRITE` / `DISCARD`.  
Alles ohne klares `KEEP` wird neu geschrieben.

### Warum kein vollständiger Neubau „ohne Repo-Blick“?

Mollie + Fiskaly + KassenSichV sind teuer neu zu erfinden. Das alte Repo ist **Referenz für Abläufe und API-Sequenzen**, nicht Lieferant für lauffähigen Code.

---

## Ist-Zustand Gwada (relevant für Mobile)

| Bereich | Stand |
|---------|-------|
| **Web** | Next.js 16, Root-Layout (noch nicht Monorepo) |
| **Auth** | Supabase Auth, `restaurant_employees` / `restaurant_staff` |
| **Speisekarte** | Relational: `menu_categories`, `menu_items`, Tags, Allergene |
| **POS/Bestellungen** | ❌ `orders`/`order_items` in Migration `20260530200000` **entfernt** („kein App-Code“) |
| **Mollie / Fiskaly** | ❌ nicht vorhanden |
| **Deploy Web** | GitHub Action → VPS, Dockerfile baut Root |

→ Die Staff-App bringt **neues** POS-Schema + **neue** Server-Integrationen mit — kein Plug-and-Play.

---

## Ziel-Architektur (Strategie A)

```text
gwada-app/
├── apps/
│   ├── web/                    ← bestehende Next.js-App (verschoben, Logik unverändert)
│   └── staff/                  ← neue Expo-App „Gwada Staff“
├── packages/
│   ├── shared/                 ← Types, Zod-Schemas, Formatierung, Konstanten
│   ├── supabase/               ← Client-Helfer (browser / mobile / server-typing)
│   └── pos-domain/             ← Bestelllogik, Preise, Status-Maschine (framework-frei)
├── supabase/                   ← zentral: Migrationen inkl. POS + TSE + Payments
├── package.json                ← pnpm workspaces (`pnpm-workspace.yaml`)
├── pnpm-workspace.yaml
└── Dockerfile                  ← Kontext: apps/web (Deploy-Pfade anpassen, `pnpm`)
```

### Backend-Anbindung: alle drei — mit klarer Trennung

#### 1. Direkt Supabase (Mobile → DB)

**Geeignet für:**

- Login / Session (`@supabase/supabase-js` + AsyncStorage)
- Speisekarte lesen (`menu_items`, `menu_categories`)
- Mitarbeiter-Kontext (`restaurant_employees`, Workspace-Restaurant)
- Bestellungen CRUD (sobald neues POS-Schema + RLS existiert)
- Realtime (Küche/KDS, offene Tische) — optional Phase 2

**Beachten:**

| Thema | Web | Mobile |
|-------|-----|--------|
| Auth-Session | Cookies (`@supabase/ssr`) | AsyncStorage / SecureStore |
| Supabase-URL | oft `/sb`-Proxy | **direkte** URL (`EXPO_PUBLIC_SUPABASE_URL`) — kein Browser-Proxy |
| RLS | gleiche Policies | gleiche Policies — Mobile nutzt Anon-Key + User-JWT |
| Service Role | nie im Client | nie im Client |

#### 2. Next.js API-Routes (Mobile → `apps/web`)

**Pflicht für:**

- **Mollie** — API-Key nur in `platform_integrations.config` (Superadmin)
- **Fiskaly TSE** — Credentials serverseitig, Signatur-Flows
- Webhooks (Mollie → `/api/pos/mollie/webhook`)
- Operationen, die Service Role oder Audit brauchen

**Beachten:**

- Mobile ruft `https://gwada.app/api/pos/...` mit Supabase-JWT im `Authorization`-Header
- Keine Secrets in `EXPO_PUBLIC_*`
- Offline-Zahlung: Queue lokal, Sync über API wenn online (später)

#### 3. Shared Packages (Web + Mobile)

**Jetzt teilen:**

- `Database` Types (`supabase gen types` → `packages/supabase/database.types.ts`)
- Zod-Schemas für Orders, Line Items, Payment States
- Preis-/Steuerberechnung, Währungsformat
- Order-Status-Enum und erlaubte Übergänge
- API-Request/Response-Types für POS-Endpunkte

**Nicht teilen:**

- React-Komponenten (Web: shadcn, Mobile: RN primitives)
- Next.js-spezifische Server-Module in Mobile importieren

---

## Phasenplan

### Phase 0 — Salvage-Audit (1–2 Tage)

**Input benötigt:** Git-URL des Expo-Repos.

- [ ] Repo klonen, Struktur dokumentieren (Screens, Services, State, API-Clients)
- [ ] Mollie-Flow kartieren (Endpunkte, Webhooks, Fehlerfälle)
- [ ] Fiskaly-Flow kartieren (TSS, Transaction, Receipt, Storno)
- [ ] Bestell-Flow kartieren (Tisch → Positionen → Küche → Bezahlung → TSE)
- [ ] Bug-/Workaround-Liste aus Issues/Kommentaren/TODOs
- [ ] Salvage-Liste: max. ~10–15 Module mit `KEEP`-Begründung
- [ ] Datenmodell Alt vs. Gwada (`menu_items` vs. alte Produkt-Tabellen) abgleichen

**Ergebnis:** `docs/plans/expo-staff-salvage-audit.md`

---

### Phase 1 — Monorepo-Grundgerüst ✅ (2026-06-07)

- [x] Root-`package.json` + `pnpm-workspace.yaml`; `"packageManager": "pnpm@9.15.0"`
- [x] Migration npm → pnpm: `pnpm-lock.yaml`, `package-lock.json` entfernt
- [x] `git mv` → `apps/web/`
- [x] `apps/web/package.json` — Web-deps/scripts
- [x] Root-Scripts: `pnpm --filter web …`
- [x] `Dockerfile` → pnpm + `apps/web`
- [x] `.github/workflows/deploy-live-app.yml` — Hinweis pnpm
- [x] `next.config.ts` — Env aus Repo-Root + `turbopack.root`
- [x] Build verifiziert: `pnpm --filter web build`
- [ ] Deploy dry-run auf VPS (nach Merge / mit Secrets)

---

### Phase 2 — Shared Packages ✅ (2026-06-07)

- [x] `packages/shared` (`@gwada/shared`) — Geld-Formatierung, Cent-Helfer
- [x] `packages/supabase` (`@gwada/supabase`) — `database.types.ts` (Stub), `createMobileSupabaseClient`
- [x] `packages/pos-domain` (`@gwada/pos-domain`) — Order-Status-Maschine, Fiskaly-VAT (aus Loyaro portiert)
- [x] `pnpm gen:types` — Supabase-Typen generieren (benötigt `pnpm db:start`)
- [x] `pnpm typecheck:packages` — Typecheck aller `@gwada/*` Pakete

**Hinweis:** Web-App nutzt Pakete noch nicht direkt — Wiring erfolgt mit Staff-App / POS-API (Phase 4–5).

---

### Phase 3 — Datenbank: POS + Payments + TSE ✅ (2026-06-07)

Migration: `supabase/migrations/20260607130000_pos_foundation.sql`

- [x] `menu_items.vat_rate` (0 / 7 / 19, Default 19)
- [x] `pos_table_sessions` — offene Tisch-Session, max. eine `open` pro Tisch
- [x] `pos_orders` + `pos_order_lines` — Cent-Beträge, Status-Enums, `order_number` pro Restaurant
- [x] `pos_payments` — Mollie-ID, Method/Status-Enums, Cash-Felder
- [x] `pos_fiscal_transactions` — Fiskaly TSE-Signatur, `tx_id` unique
- [x] RLS via `auth_is_restaurant_staff(restaurant_id)` + Integritäts-Trigger
- [x] Realtime: `pos_table_sessions`, `pos_orders`, `pos_payments`
- [ ] Lokal angewendet: `pnpm db:push:local` (benötigt `pnpm db:start` / Docker)

Nach `db:start`: `pnpm db:push:local` und `pnpm gen:types` ausführen.

---

### Phase 4 — Server-APIs in `apps/web` ✅ MVP (Cash + Fiskaly, 2026-06-08)

Secrets nur über `platform_integrations` (Superadmin UI):

- [x] Integration-Typ `fiskaly` in DB/Config + Superadmin-UI (`*_configured`)
- [x] `mollie` in DB (Zeile); Superadmin-UI + Zahlungsflow **noch offen** (Option C: nach Cash-MVP)
- [x] `POST /api/pos/orders` — Bestellung anlegen
- [x] Barzahlung: `PATCH /api/pos/payments/collect-cash/[orderId]` (statt `…/pay`)
- [x] TSE nach Zahlung in `pos-payment-pipeline` + `POST …/retry-signing` (statt `…/fiscalize`)
- [ ] `POST /api/pos/orders/[id]/pay` — Mollie Payment (Stub: `POST /api/pos/payments` → 501)
- [ ] `POST /api/pos/mollie/webhook` — echter Status-Update (aktuell Stub)
- [x] Auth-Middleware: Supabase-JWT + Staff-Check (`pos-route-auth.ts`)
- [x] Superadmin Fiskaly: `api_key_configured` / `api_secret_configured`, kein Klartext

---

### Phase 5 — Expo App „Gwada Staff“ (Neubau) ✅ MVP (2026-06-08)

- [x] `apps/staff` — Expo SDK 56, expo-router, Monorepo-Pakete
- [ ] Branding: echtes Gwada-Logo + `platform_app_settings` (aktuell: Platzhalter + `brand_accent_hex` teilweise)
- [ ] Auth: Magic Link + Deep Link (`gwada-staff://`) — aktuell nur Passwort-Login
- [x] Workspace-Restaurant-Auswahl (`active_restaurant_id`)
- [x] Speisekarte read-only (`menu_items`; ohne Kategorien/Extras)
- [x] Bestell-Flow: Tisch → Positionen → senden
- [x] Bezahl-Flow v1 Bar über Web-API
- [x] TSE + PDF-Beleg über Web-API (Viewer + Teilen)
- [x] Skeleton-Loader auf Hauptscreens (`useDeferredSkeleton`)
- [x] iOS-Target: `app.gwada.staff`, Simulator-Script `scripts/staff-ios-simulator.sh`
- [x] Kasse-Tab (bei `pos.kasse.*`), DSFinV-K Runtime-Export, Speisekarte nach Kategorien

**UI:** komplett neu — kein Copy der alten Screens. Orientierung an Gwada-Web (Typografie, Akzent, Karten).

---

### Phase 6 — Manuelle Releases ← **aktuell**

- [ ] Expo lokal: `npx expo run:ios` / EAS optional später — Anleitung [`staff-app-testflight.md`](./staff-app-testflight.md)
- [ ] TestFlight manuell (kein CI für Mobile in Phase 1)
- [x] Internes Testprotokoll: [`staff-app-e2e-test-protocol.md`](./staff-app-e2e-test-protocol.md)
- [x] Protokoll TC-01–05 + TC-07 durchgespielt; TC-06 (TSE-Retry Fehlerfall) offen

---

### Phase 7 — Gäste-App (später)

Erst wenn Staff-App stabil:

- [ ] `apps/guest` — Loyalty, Prämien
- [ ] Shared: `packages/shared`, Auth, evtl. eigene RLS-Policies
- [ ] Android erst nach iOS-Staff-Stabilisierung

---

## Risiken & Mitigationen

| Risiko | Mitigation |
|--------|------------|
| Monorepo bricht Web-Deploy | Phase 1 mit Deploy dry-run + build-info-Check vor Merge |
| TSE-Fehler in Production | Fiskaly Sandbox zuerst; Server-API mit Idempotenz |
| Mollie-Webhooks | Dedizierter Endpunkt, Signatur prüfen, Retry-sicher |
| Teamkollege auf `develop` | Plan-Branch regelmäßig `main` rebasen vor Integrations-PR |
| Bug-Erbe aus Alt-App | Salvage-Audit + Neubau-Default |
| Offline-Kellner | Explizit Phase 2 — nicht in MVP unless Audit zeigt Must-Have |

---

## Quell-Repo (Audit abgeschlossen)

- **URL:** https://github.com/dmgitc/loyaro
- **Kellner-App:** `apps/employee` (Expo 54, RN 0.81.5, expo-router 6)
- **Backend-Referenz:** `apps/api` (NestJS + Prisma) — Logik salvagen, nicht deployen
- **Audit-Dokument:** [`expo-staff-salvage-audit.md`](./expo-staff-salvage-audit.md)

### Architektur-Erkenntnis

Loyaro Employee-App ist ein **dünner REST-Client** — Mollie/Fiskaly/Orders laufen in NestJS.  
Gwada portiert diese Logik nach **Next.js API Routes** + **Supabase** (kein NestJS, kein Prisma).

### Schema-Lücken Gwada (vor POS-MVP)

- `menu_items`: fehlt `vat_rate`, Extras/Sides (Loyaro `ProductExtra` / `ProductSideItems`)
- `dining_tables`: fehlt `table_sessions`
- POS-Tabellen: neu (`pos_orders`, `pos_payments`, `pos_fiscal_transactions`)

## Entscheidungen (Stand)

| Thema | Stand |
|-------|-------|
| **Ansatz** | Neubau + Salvage (Loyaro als Referenz) |
| **Mollie** | ⏸️ **Zurückgestellt** — Option C (Hybrid); Webhook braucht öffentliche Domain (`new.gwada.app`), nicht localhost |
| **Fiskaly TEST** | ✅ Credentials vorhanden |
| **Apple / Bundle ID** | ⏳ wird später angelegt (Dev: Simulator / Expo Go) |
| **Package Manager** | ✅ **pnpm** (Workspaces, Lockfile `pnpm-lock.yaml`) |

Details: [`expo-staff-salvage-audit.md` → Mollie-Strategie](./expo-staff-salvage-audit.md#mollie-strategie)

## Offen

1. ~~Mollie-Strategie~~ — **Option C** (bestätigt)
2. ~~Fiskaly TEST~~ — erledigt
3. **Apple:** Team ID + Bundle ID — vor TestFlight

---

## Nächste Schritte

1. ~~Phase 0 Salvage-Audit~~ — erledigt
2. ~~Phase 1 Monorepo-Scaffold~~ — erledigt
3. ~~Phase 2 Shared Packages~~ — erledigt
4. ~~Phase 3 POS-Schema~~ — erledigt
5. ~~Phase 4 MVP~~ — Cash + Fiskaly + PDF; Mollie bewusst offen
6. ~~Phase 5 MVP~~ — Staff-App lauffähig; Branding/Magic-Link offen
7. **Phase 6 (läuft):** TC-06 abschließen → `expo run:ios` / TestFlight ([`staff-app-testflight.md`](./staff-app-testflight.md))
8. **Danach:** Mollie auf Staging/Live-Domain (Superadmin + Pay + Webhook)
9. **Später:** Gäste-App (Phase 7)
