# Kellner-App — Native Swift + iPad-Hub (Umsetzungsplan)

Stand: Juli 2026 · Entscheidungen abgestimmt mit Produkt.
Referenzen: Briefing `kellner-app-briefing`, Prototyp `kellner-app-prototyp.jsx` (v3), Repo-Ist `apps/staff` (Expo, Soft-Freeze).

---

## 0. Beschlossene Richtung

| # | Entscheidung |
|---|---|
| A1 | **Native Swift/SwiftUI** (iPhone Kellner, iPad Hub). Expo nur Backup. |
| A2 | Expo Staff (`apps/staff`): **Soft-Freeze** — keine Feature-Arbeit; Entfernung nach Swift-Parität. |
| A3 | **iPad-Hub local-first**, Discovery via **Bonjour** (`_hirsch-pos._tcp` / finaler Service-Name). |
| B4 | Backend-API für POS: **NestJS** (neu), nicht Next.js `/api/pos` als Dauerziel. |
| B5 | TSE: **Fiskaly Cloud** (bestehende Plattform-Integration wiederverwenden/migrieren). |
| C6 | v1-Scope = **gesamter Prototyp**: Timeline, Walk-in, Umzug, Modifier, Split (Person+Anteil), Übergabe, Papier-Bon/Beleg. |
| C7 | Tabs: **Tische · Reservierungen · Mehr** (Platz für 4.). |
| C8 | Zahlarten: **Bar · PayPal · Karte** — Karte/PayPal über **Mollie**. |
| D9 | Flow **1:1 Prototyp**, Datenmodell Session-basiert (nicht Tischname). |
| D10 | Artikel-Modifier: **neue Admin-/DB-Felder** wie Prototyp (`groups`, `sides`, `sidePrice`, `includedCount`). |
| D11 | **Capability-Modell** neu (Rollen nur Bundles im Web-Admin). |
| E12 | Farben: Basis-Theme Prototyp, **Akzent = Restaurant-Branding** (`accent`). |
| E13 | Tab-Bar: **native iOS 26 `TabView`** (Liquid Glass Standard) — nicht nachbauen. |

---

## 1. Architektur-Zielbild

```text
┌─────────────────┐     Bonjour / LAN WS      ┌──────────────────────┐
│  iPhone Kellner │ ◄───────────────────────► │  iPad Hub (SoT LAN)  │
│  SwiftUI Client │   Events + Snapshot Sync  │  SwiftData/GRDB      │
└────────┬────────┘                           │  Bondrucker SDK      │
         │ (Fallback wenn Hub down)           └──────────┬───────────┘
         │                                               │ Outbox + Idempotency
         │                                               ▼
         │                                    ┌──────────────────────┐
         └───────────────────────────────────►│  NestJS POS API       │
                                              │  Fiskaly · Mollie     │
                                              │  Auth / Capabilities  │
                                              └──────────┬───────────┘
                                                         │
                                              ┌──────────▼───────────┐
                                              │  PostgreSQL (Supabase│
                                              │  Schema + Redis)     │
                                              └──────────────────────┘

Web-Admin (apps/web): Speisekarte, Modifier, Caps/Rollen, Geräte-Enrollment,
                      Reservierungen, Fiskaly-Provision, Standort-Branding.
```

### Verantwortungsteilung

| Komponente | Verantwortung |
|---|---|
| **iPhone** | UI 1:1 Prototyp; spricht primär Hub; Fallback Outbox → Nest wenn Hub offline |
| **iPad Hub** | Source of Truth im WLAN; append-only Event-Log; Küchenbon; PIN-Hash-Cache; Sync Outbox → Nest |
| **NestJS** | Autoritative Cloud: Sessions, Zahlungen, TSE-Signatur, Mollie, DSFinV-K-Export, Geräte/Enrollment, Caps |
| **Supabase/Postgres** | Persistenz-Schema (weiterhin), Realtime optional für Web; Swift nutzt Nest als API |
| **apps/web** | Admin + bestehende Fiskaly-Superadmin-UI; POS-Route-Handler schrittweise **ablösen** zugunsten Nest |

### Fiskaly Cloud + Local-First (explizit)

- Bestellung, Gänge schicken, Tischplan, Umzug, Übergabe: **offline am Hub** möglich.
- **Zahlung mit TSE**: braucht Internet (Fiskaly Cloud). Hub queued Zahlung → signiert online → Beleg.
- Bei Netzausfall während Zahlung: KassenSichV-Ausfallkennzeichnung dokumentieren (kein Dauerzustand); UX blockiert „Kassieren“ mit klarer Meldung oder Ausfall-Pfad (Policy später festziehen).

---

## 2. Soft-Freeze Expo & Nest-Migration

### Expo (`apps/staff`)
- Keine neuen Features / keine UX-Anpassung an Prototyp.
- Nur kritische Hotfixes (Security, Build-Break).
- Doku: dieser Plan ersetzt `expo-staff-app-integration.md` als **Zielbild**; Expo-Pläne bleiben historische Referenz / Salvage-Liste.
- Entfernen: eigener PR wenn Swift v1 (Parität §6) + TestFlight/Pilot OK.

### Bestehendes Next `/api/pos/*` + `packages/pos-domain`
- **Salvage**, nicht wegwerfen: Fiskaly-Sequenzen, Mollie-Webhook-Flow, VAT/Settlement-Hilfen → Nest-Module bzw. shared Package.
- Neue Split-State-Machine (Person ↔ Anteil, Einbahnstraße) in shared Domain (TypeScript für Nest + Tests; Swift spiegelt Regeln oder nutzt generierte Spec-Fixtures).
- Web-Staff-Kasse darf übergangsweise Next nutzen; Cutover-Datum = Nest stabil + Swift Pilot.

### Neues Repo-Layout (Ziel)

```text
apps/
  web/                 # Admin SaaS (bestehend)
  staff/               # Expo — soft-freeze → später löschen
  pos/                 # Swift iPad-Hub + iPhone (BESTEHEND, XcodeGen)
  pos-api/             # NestJS Cloud-API (Phase 0+)
packages/
  pos-domain/          # Split-SM, Caps-Typen, Modifier-Pricing (+ fixtures/)
  shared/
supabase/migrations/   # Schema-Erweiterungen (§3)
```

> **Kein paralleles `ios/`:** Swift lebt in `apps/pos` (Bonjour `_gwada-pos._tcp` bereits).  
> Event-Konvention: [`kellner-event-protocol.md`](./kellner-event-protocol.md).
---

## 3. Datenmodell — Lücken zum Prototyp

Bestehend nutzbar: `dining_areas` / `dining_tables`, `pos_table_sessions`, `pos_orders` / `pos_order_lines`, Reservierungen, Fiskaly-Register, Staff-PIN-Hashes.

### 3.1 Session & Tischstatus (1:1 Prototyp)

Prototyp-Status: `frei | besetzt | bestellt | serviert | zahlen | bezahlt`.

Mapping-Vorschlag:

| UI-Status | Persistenz |
|---|---|
| frei | keine offene Session am Tisch |
| besetzt | Session `open`, noch kein `course.fired` |
| bestellt | mind. ein Gang geschickt, nicht serviert/zahlen |
| serviert | optional Küchen-Feedback / manuell (v1: manuell oder weglassen bis KDS) |
| zahlen | Kellner → Rechnung (`toBill`) |
| bezahlt | alle Positionen/Anteile beglichen, Session **noch offen** (`paid_pending_release`) |
| freigeben | `table.released` → Session `closed`, Tisch wieder frei |

**Pflichtfelder Session:** `id`, `dining_table_id`, `owner_waiter_id`, `cover_count`, `seated_at`, `status`, `settlement_mode` (`item` \| `amount`), `settled_cents`, `reservation_id?`.

Belege/Zahlungen hängen an **`session_id`**, nie nur am Tischnamen.

### 3.2 Bestellzeilen

- `course` 1–3, `sent_at` / `fired`, `person` (nullable), `paid` / `paid_quantity`
- `mods` Snapshot JSON: `{ options[], sides[], note }` — Merge nur bei gleicher Signatur
- Küchen-Hinweis max. 80 Zeichen

### 3.3 Modifier-Katalog (Admin + API)

Neue Tabellen (Skizze):

- `menu_modifier_groups` (item_id, key, name, required, max_select)
- `menu_modifier_options` (group_id, name, delta_cents)
- `menu_item_side_config` (item_id, required, max, included_count)
- `menu_items.side_price_cents` nullable (Beilagen-Artikel: Preis „als Beilage“)

Beilagen bleiben echte `menu_items` in Kategorie Beilagen; Side-Config referenziert sie.

### 3.4 Capabilities

- `pos_capabilities` Katalog (`transfer`, `day_close`, `void`, `cash_count`, `reports`, `devices`, …)
- `pos_roles` (Admin-Bundle) → `pos_role_capabilities`
- Staff-Zuweisung: Role und/oder direkte Caps
- Hub cached Caps + Argon2id-PIN-Hashes für Offline-Login
- App: `profile.can(x)` — fehlende Einträge **verstecken**; Nest prüft serverseitig erneut

### 3.5 Events (Hub-Protokoll, append-only)

`device.enrolled`, `waiter.logged_in/out`, `shift.opened/closed`,  
`session.opened`, `order.line_added`, `order.line_qty_changed`, `course.fired`,  
`table.moved`, `reservation.seated`, `walk_in.seated`,  
`payment.completed` (+ TSE-Payload), `session.transferred`, `table.released`,  
`settlement.mode_switched` (nur `item → amount`).

Jedes Event: `event_id` (UUID), `restaurant_id`, `device_id`, `waiter_id?`, `session_id?`, `ts`, `payload`, `idempotency_key`.

---

## 4. NestJS POS-API — Module

| Modul | Endpunkte / Aufgaben |
|---|---|
| `auth/devices` | Enrollment-Code, Device-Token, Standortbindung |
| `auth/waiters` | PIN-Verify (online), Caps-Snapshot, Hash-Sync für Hub |
| `floor` | Tische + abgeleiteter Status, Sessions CRUD |
| `orders` | Lines, Modifier-Resolve, Fire Course, Move Table |
| `reservations` | Tagesliste, Seat, Konflikt-Metadaten (Fenster) |
| `payments` | Bar / Mollie Card / Mollie PayPal-QR; Tip; Teilzahlungen |
| `fiscal` | Fiskaly start/finish Tx, Belegdaten, DSFinV-K, X/Z |
| `shifts` | Open/Close, Transfer (4-Augen server-seitig mit PIN-Hash des Übernehmers) |
| `sync` | Hub Outbox bulk ingest (idempotent) |
| `catalog` | Menu + Modifier-Config für Hub-Cache |
| `branding` | Accent + Venue-Stammdaten für Beleg |

**Auth:** Device-Token (Keychain) + flüchtige Waiter-Session; Service-Role nur Nest↔DB.

**Salvage-Quellen:** `apps/web/lib/pos/*`, `apps/web/app/api/pos/**`, `packages/pos-domain`.

---

## 5. Swift-Apps

### 5.1 SharedKit
- Design Tokens (Prototyp-Palette + dynamischer `accent` vom Standort)
- Formatierer (`12,50 €`, Zeiten)
- Event-Typen, Snapshot-Models
- Networking (Hub WS + Nest REST Fallback)
- Split/Settlement Pure Swift (Spiegel der Domain-Regeln) + Fixture-Tests gegen TS-Golden-Files

### 5.2 iPhone (Kellner) — Screens = Prototyp
1. PIN-Lock (6 Stellen, Lockout, NFC später; Face ID nur persönliche Geräte)
2. Tab **Tische** — Grid, Timer, Owner-Badge, nächste Res.
3. Tab **Reservierungen** — Timeline 17–23 (später Öffnungszeiten), Jetzt-Marker, Demnächst, Walk-in
4. Tab **Mehr** — Caps-gefiltert (Übergabe, Tagesbelege, Stubs für Z/Storno/…)
5. Order + Modifier-Sheet + Papier-Bon-Sheet
6. Split/Kassieren (State Machine) + PaymentSheet (Bar/Karte/PayPal)
7. Gastbeleg (KassenSichV-Felder) + ShareLink
8. MoveSheet, HandoverSheet (kein Demo-Bypass in Release)

iOS 26: `TabView`, `.tabBarMinimizeBehavior(.onScrollDown)`; in Order/Split TabBar hidden; optional `tabViewBottomAccessory` für Bon-Leiste.

### 5.3 iPad Hub
- Enrollment / Standort
- Bonjour `NWListener`
- Event-Log + Snapshot für Clients
- PIN/Caps-Cache Sync
- Outbox → Nest (`NWPathMonitor`)
- Bondrucker (Epson/Star) — Layout ≈ Papier-Bon
- Status-UI (verbunden, Sync-Queue, TSE online/offline)

Mindest-Target: mit Produkt klären (Empfehlung: **iOS 26** für Liquid Glass; sonst Feature-Flag UI ohne Glass).

---

## 6. v1 Feature-Parität (Akzeptanz)

Abhaken = Swift+Hub+Nest decken den Prototyp-Flow ab:

- [ ] Device-Enrollment + PIN-Login offline am Hub *(PIN-Lock lokal ✅; Enrollment-Code Admin Phase 1)*
- [x] Tischplan Status/Timer/Summe/Res-Hinweis
- [x] Session eröffnen (Tap / Walk-in / Reservierung)
- [ ] Bestellung: Kategorien, Ein-Tap vs Modifier-Sheet, Gänge, Fire → Küchenbon
- [x] Tisch umziehen (Order+Gäste+Timer+Settled wandern)
- [x] Reservierungs-Timeline + Konflikt <60 min + Platzieren
- [x] Split Person (1 Einheit/Tap) + Gleich teilen + Sperre Anteile→Person
- [x] Zahlung Bar / Mollie Karte / Mollie PayPal + Trinkgeld
- [x] TSE-Felder auf Beleg + Teilen; Belegliste pro Session
- [ ] Status bezahlt → explizite Freigabe; Abbruch nur vor erstem Fire
- [x] Schichtübergabe 4-Augen-PIN
- [x] Caps steuern Mehr-Tab
- [x] Branding-Accent vom Restaurant
- [x] Hub-Sync Outbox idempotent; Client-Fallback dokumentiert

Nicht v1 (Briefing offen, nachziehen): Storno-UI, Z-Bericht-UI vollständig, Auto-Lock-Config-UI, Hardware-TSE, Face-ID-Policy-Admin.

---

## 7. Phasenplan (Implementierung am Laptop)

### Phase 0 — Fundament (kein Feature-UI)
1. Soft-Freeze-Notiz in `apps/staff/README` + AGENTS-Hinweis.
2. Scaffold `apps/pos-api` (NestJS) + CI-Job smoke.
3. Swift-Home = bestehendes `apps/pos` (xcodegen; kein neues `ios/`).
4. Event-Schema + Idempotency-Konvention (`docs/plans/kellner-event-protocol.md`).
5. Domain: Split-State-Machine + Tests in `packages/pos-domain` (Golden JSON für Swift).

**Exit:** Nest health, `apps/pos` öffnet via xcodegen, Domain-Tests grün.
### Phase 1 — Schema & Admin
1. Migrationen: Session-Status/`owner`/`settlement`, Side-Config, Capabilities/Roles, Devices.
2. Web-Admin: POS → Einstellungen → **Geräte & Rechte** (+ Beilagen-Config); Optionsgruppen bleiben Speisekarte.
3. Nest: `GET /v1/catalog`, `GET /v1/branding` (Service-Role).

**Exit:** Caps/Rollen + Enrollment-Code im Admin; Catalog/Branding am Nest erreichbar (mit Supabase-Env).
### Phase 2 — Nest Kern + Fiskaly/Mollie Salvage
1. Sessions/Orders/Fire/Move/Release — Nest `v1/sessions`, `v1/orders`.
2. Payments: Bar + Mollie-Simulate (Card/PayPal) inkl. Allocations + Receipt-Payload.
3. TSE: `FISKALY_MODE=simulate` schreibt `pos_fiscal_transactions`; echter Fiskaly-Client folgt (Salvage aus `lib/pos/fiskaly-client.ts`).
4. Sync ingest `POST /v1/sync/events` + Tabelle `pos_sync_events`.
5. Shift transfer `POST /v1/shifts/transfer` (Display-PIN / relaxed).

**Exit:** Curl-Flow `docs/plans/kellner-pos-api-phase2-curl.md` (mit Supabase-Env).

### Phase 3 — iPad Hub MVP ✅ (2026-07-20)
1. Bonjour + LAN-HTTP (Bestand `_gwada-pos._tcp` :8787; WS-Push später).
2. Lokale Persistenz + Snapshot (`snapshotVersion`, `waiterCaps`).
3. Outbox Sync → Nest `POST /v1/sync/events` wenn Nest-URL gesetzt (`PosNestClient` + stabile `PosDeviceIdentity`); sonst Next `/api/pos`.
4. PIN-Cache: `PosWaiterPinCache` (Caps/Metadaten, keine Klartext-PINs) → Snapshot.
5. (Drucker-Stub OK, echter SDK parallel).

**Exit:** Zwei Simulatoren: Hub + Client tauschen Tisch-Events ohne Cloud (LAN unverändert). Nest-Outbox optional in Geräteeinstellungen.

### Phase 4 — iPhone UI 1:1 Prototyp ✅ (2026-07-20)
1. Design Tokens + Accent Injection (`PosDesign`, Tenant-Accent).
2. PIN-Lock, Tabs (Tische · Reservierungen · Mehr), Floor-Grid, Resv-Timeline, Walk-in, Order/Split/Pay (Bar+Karte/PayPal Nest), Receipt-Share, More (Caps), Handover, Move-Session.
3. Hub-Anbindung unverändert; Nest-Fallback-Flag `nestClientFallbackEnabled` für Handheld bei Hub-Ausfall.

**Exit:** Manueller Walkthrough auf iPhone-Simulator + iPad-Hub (PIN → Tabs → Tisch → Order → Split → Beleg).

### Phase 5 — Härtung & Pilot
1. Audit-Log, Lockout, Keychain.
2. Offline-/Online-Matrix testen (Zahlung nur online).
3. TestFlight Kellner + Hub.
4. Expo-Entfernungs-PR vorbereiten (nach Pilot-Signoff).

**Exit:** Ein Standort Pilot-Schicht; Checklist signiert.

---

## 8. Teststrategie

| Schicht | Was |
|---|---|
| Domain TS | Split-Invariante Σ Zahlungen = Summe; Mode-Einbahnstraße |
| Nest e2e | Session→Pay→TSE→Release; Transfer 4-Augen; Idempotent Sync |
| Swift unit | Settlement-Spiegel, Modifier-Preis, freeWindow |
| Integration | Hub↔Client Event-Replay; Nest Outbox |
| Manual | Prototyp-Szenarien (Weber-Res Konflikt, Walk-in, Umzug, Split-Mix) |

---

## 9. Risiken & Gegenmaßnahmen

| Risiko | Maßnahme |
|---|---|
| Doppelte POS-APIs (Next + Nest) | Klare Cutover-Liste; Web POS-Routes deprecated markieren |
| Cloud-TSE vs. Offline-Hub | UX: Kassieren braucht Netz; Bestellen nicht |
| Schema drift Expo vs Swift | Soft-Freeze Expo; eine Migrationslinie |
| iOS 26 only | Deployment-Target früh festlegen; sonst TabBar ohne Glass |
| Scope v1 zu groß | Phasen-Exits strikt; Storno/Z-Bericht bewusst nach v1 |
| Nest neu vs. Zeit | Maximal Salvage aus `lib/pos` + `pos-domain` |

---

## 10. Erste konkrete Tickets (wenn Laptop bereit)

1. ~~`docs`: Soft-Freeze Banner in `apps/staff` + Link auf diesen Plan.~~
2. ~~`chore`: NestJS Scaffold `apps/pos-api`.~~
3. ~~`chore`: Swift-Home dokumentieren (`apps/pos` + Event-Protokoll).~~
4. ~~`feat(pos-domain)`: Split state machine + golden fixtures.~~
5. `feat(db)`: Migration Session owner/status/settlement + modifier tables.
6. `feat(web)`: Capability Admin + Modifier Admin (minimal).
7. `feat(api)`: Catalog + Device enroll + Session open/close.
8. `feat(ios-hub)`: Event-Envelope an bestehendes LAN-Protokoll anbinden.
9. `feat(ios-kellner)`: Prototyp-UX (Tabs Tische/Resv/Mehr) in `apps/pos`.

---

## 11. Offene Feindetails (nicht blockierend für Start)

- Finaler Bonjour-Service-Name (`_gwada-pos._tcp` vs `_hirsch-pos._tcp`).
- Ob Status `serviert` in v1 manuell gesetzt wird oder entfällt bis KDS.
- PayPal: Mollie Hosted vs. QR-API — an Mollie-Produktfähigkeit koppeln; UX wie Prototyp belassen.
- Mindest-iOS-Version / iPad-only Hub vs. Universal.
- Ob Nest im Monorepo deployt wird (Coolify/Docker) parallel zu `apps/web`.

Diese Punkte beim Kickoff Phase 0 in 15 Minuten entscheiden und hier nachtragen.
