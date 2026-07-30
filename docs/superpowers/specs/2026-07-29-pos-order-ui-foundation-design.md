# POS Order-UI Fundament (Phase 1) — Design

Stand: abgestimmt 2026-07-29. Fundament für Bestellaufnahme / Bon / Küche
(Phasen 2–4 folgen in eigenen Specs). Bezieht sich auf den bestehenden Swift-POS
(`apps/pos`) + Nest (`apps/pos-api`) + Web-Bootstrap.

## Ziel & Scope

Daten- und Design-Fundament, damit Phase 2 (Order-Screen) und Phase 3 (Papier-Bon,
Fire-pro-Gang) auf stabilen Tokens, numerischen Gängen und vollständigem Menü-Datenpfad
aufsetzen können — **ohne** das neue Order-UI schon zu bauen.

### Entscheidungen (fest)

| Thema | Wahl |
|-------|------|
| Fonts | **System-Fonts** als Platzhalter (Display/Body/Mono-tabular); Custom-Fonts später |
| Gänge | **Echte Int-Migration** (`course Int ≥ 1`), Dev-DB-CI wie gehabt |
| `side`/`drink`/`other` | Entfallen; Zeilen tragen denselben Gang wie Speise (Aktiver Gang) |
| Mapping Alt→Neu | `starter→1`, `main→2`, `dessert→3`, `side\|drink\|other→2` |
| UI-Gang-Range (später Phase 2) | Chips/Stepper **1–3**; DB erlaubt `≥ 1` (4+ ohne Schema-Change) |
| Liefer-Schnitt | **Ein Spec, parallelisierbar** (1a–1f); 1d eigener Task mit Dev-Push |

### In Scope (1a–1f)

- **1a** Design-Tokens in `PosDesign` (bg/surface/surface2/line/ink/muted/brass/paper/green,
  Status-Punkt-Farben); `courseColor` auf Int umstellen
- **1b** Text-Styles (Display / Body / Mono-tabular) über System-Fonts
- **1c** Wiederverwendbare Papier-Bon-View (Sägezahnkante, Paper-Farben) — Shell ohne volle
  Cart-/Fire-Logik
- **1d** DB: `pos_order_lines.course` → `integer`; `pos_kds_devices.courses` → `integer[]`;
  Enum `pos_order_course` droppen; Domain/API/Swift anpassen
- **1e** Menü-Datenpfad Beilagen: Web-Bootstrap + Swift + LAN-Snapshot
  (`sidePriceCents`, `sides` / side-config, Beilagen-Kategorie als Side-Pool)
- **1f** Optionsgruppen `minSelect`/`maxSelect` im Swift-Modell **nutzbar machen**
  (bereits decodiert; Helper/API für Phase 2d — noch keine UI-Erzwingung)

### Nicht in Scope (Phasen 2–4)

- Order-Screen 2-Spalten, Einhand-Dock, One-Tap-Bonieren
- ModifierSheet-UX (Pflicht/Max, Beilagen-Grid, Live-Preis-CTA)
- Cart-Merge, volles Bon-Sheet mit Gang-Gruppierung, Fire-UI pro Gang
- Offline-Retry-Feinschliff für neues Modell (Phase 3e)
- Liquid Glass TabView / iOS 26 (Phase 4a)
- Lizenzierte Custom-Fonts (Bricolage / Instrument / Spline)
- Live-DB-Deploy (nur auf ausdrückliche Nutzer-Anfrage)

## Ausgangslage (Ist)

### Design

- `PosDesign.swift`: System-Surfaces, Status-Farben, Accent-Hex, `courseColor(PosCourse)` —
  **kein** warmes Paper/Brass-Token-Set, keine Display/Body/Mono-Text-Styles.
- Keine Font-Dateien unter `apps/pos`; kein `Font.custom`.
- Keine Sägezahn-/Papier-Beleg-View; ESC/POS und Web-PDF sind andere Pfade.

### Gänge

- DB: Enum `public.pos_order_course` (`starter|main|dessert|side|drink|other`) auf
  `pos_order_lines.course` und `pos_kds_devices.courses pos_order_course[]`
  (`20260716180000_pos_cart_courses_kds.sql`).
- Swift: `PosCourse: String` enum (`PosCartModels.swift`); UI wählt Gang pro Zeile in
  `LineConfigureSheet`.
- Nest: speichert noch Enum-Strings; `COURSE_MAP` mappt bereits `"1"|"2"|"3"` → Enum
  (`orders.service.ts`) — Übergangshilfe, Zielzustand Int.
- `packages/pos-domain`: String-Union `PosOrderCourse`.
- KDS-Filter und Fire-Course nutzen String-Gänge; Swift-UI feuert oft hardcodiert `"main"`.

### Beilagen / Options

- DB + Web-Admin: `menu_items.side_price_cents`, `menu_item_side_config`
  (`required`, `max_sides`, `included_count`) — vorhanden.
- Nest `GET /v1/catalog`: liefert `sidePriceCents` + `sides` — vorhanden.
- Web `GET /api/pos/bootstrap`: **keine** Side-Felder auf Items.
- Swift `PosCloudMenuItem`: **keine** Side-Felder; OptionGroups haben `minSelect`/`maxSelect`,
  werden in `LineConfigureSheet` **nicht** enforced.
- Kategorie „Beilagen“ existiert in Web-Constants (`categories.ts`); kein Swift Side-Pool.

## Architektur

Ansatz **Parallel-Fundament**: Design-Shell (1a–1c) und Datenpfad (1d–1f) in einem Plan,
Tasks nach Schicht (Migration → Domain/API → Swift Models → UI Tokens/Paper).

Verworfen: Design-first ohne Migration (Bon/Fire hängen an Int); Daten-first ohne Tokens
(Phase-2-UI startet ohne visuelle Basis).

### Komponenten

**1a / 1b — `PosDesign` erweitern**

Neue Farb-Tokens (Light-first; Dark später oder adaptive Varianten, wenn im Prototyp
vorgesehen — sonst feste Warm-Palette wie im Produktentwurf):

| Token | Rolle |
|-------|--------|
| `bg` | App-Hintergrund |
| `surface` / `surface2` | Karten / erhöhte Flächen |
| `line` | Borders / Trenner |
| `ink` / `muted` | Primär- / Sekundärtext |
| `brass` | Akzent-Metall (neben Tenant-Accent) |
| `paper` | Beleg-Hintergrund |
| `green` | Erfolg / bezahlt / positiv |

Status-Punkt-Farben (Tischplan/Timer) an Tokens anbinden bzw. ergänzen (inkl. Vorbereitung
für Phase-4b amber ab 45 min — Farbe definieren, Timer-Logik noch nicht).

Text-Styles (System):

| Style | System-Font-Richtung |
|-------|----------------------|
| Display | `.largeTitle` / rounded bold — Platzhalter für Bricolage |
| Body | `.body` / `.headline` — Platzhalter für Instrument Sans |
| Mono tabular | `.body.monospaced().monospacedDigit()` — Platzhalter für Spline |

`courseColor(_ course: Int)` — z. B. 1 orange, 2 accent/brass, 3 pink; `≥ 4` secondary.

**1c — `PaperReceiptView` (Arbeitstitel)**

Wiederverwendbare SwiftUI-Shell:

- Hintergrund `paper`, Tinte `ink`/`muted`
- Obere/untere **Sägezahnkante** (Shape + `clipShape` oder Overlay-Path)
- Inhalts-`ViewBuilder` Slot (Phase 1: Demo-/Preview-Inhalt ok; Phase 3 füllt Bon-Inhalt)
- Keine Abhängigkeit von Cart-State in Phase 1

**1d — Numerischer Gang**

Migration (eine Datei unter `supabase/migrations/`):

1. `pos_order_lines`: Spalte `course_int integer` (oder in-place nach Staging-Spalte):
   - Update-Map wie oben; `NOT NULL DEFAULT 2`; Check `course >= 1`
2. `pos_kds_devices.courses`: Enum-Array → `integer[]` mit gleicher Map pro Element
3. Alte Enum-Spalte/Typ entfernen (`pos_order_course`)
4. Comment aktualisieren: „Gang-Nummer ≥ 1 (UI typisch 1–3)“

Danach **`pnpm db:push`** (Dev-VPS / CI). Live nur auf Anfrage.

Domain / API:

- `packages/pos-domain`: `PosOrderCourse` → `number` (oder `course: number`); Labels
  `1→Vorspeise`, `2→Hauptgang`, `3→Dessert`, sonst `Gang N`
- Nest Orders: `course` als number speichern/lesen; `fire-course` filtert per Int;
  Legacy-String-Keys in Input kurz tolerieren (Map → Int), Output nur Int
- Web `/api/pos/*` Order-Lines + KDS: Int
- Swift: `PosCourse` als `Int` (oder `typealias` + Helpers `label`/`shortLabel` für 1…3);
  Codable Int; LAN-Snapshot/KDS-Device `courses: [Int]`
- Bestehende UI nur **minimal** anpassen (kompilierbar): `LineConfigureSheet` /
  KDS-Anzeige / Fire-Calls nutzen Int 1–3 — **kein** Redesign (das ist Phase 2)
- Types: `database.types.ts` regenerieren / course-Felder nachziehen (aktuell Drift)
- Web-Admin KDS-Geräte-Filter: Courses als Int speichern/laden (gleicher 1d-Task)

**1e — Beilagen-Datenpfad**

- Web `pos-bootstrap-server`: pro Item `sidePriceCents` + `sides: { required, max, includedCount } | null`
  (Naming an Nest-Catalog angleichen)
- Swift `PosCloudMenuItem`: dieselben Felder decode/encode
- `PosCloudMenuCatalog` (oder Helper): Side-Pool = aktive Items der Kategorie **Beilagen**
  (Name-Match `"Beilagen"` und/oder bekannte Category-ID-Konstante, falls Hub sie mitsendet;
  robust: Kategorie-Name case-insensitive + optional Flag später)
- LAN-Snapshot: Menü unverändert durchreichen, sobald Bootstrap-Shape erweitert ist
  (kein separates Side-Schema)

**1f — Options min/max nutzbar**

- Bestehende `PosCloudMenuOptionGroup.minSelect` / `maxSelect` belassen
- Kleiner Helper z. B. `func selectionValid(selectedCount:) -> Bool` bzw.
  `clampedMax` — von Phase 2d aufrufbar
- Keine Änderung an `LineConfigureSheet` in Phase 1 (vermeidet Doppelarbeit mit 2d)

## Datenfluss

```
Dev-DB Migration (course Int, kds courses int[])
        │
        ▼
pos-domain + Nest catalog/orders + Web bootstrap
        │
        ▼
Swift PosBootstrapModels / PosCartModels / LAN snapshot
        │
        ├── PosDesign tokens + text styles + PaperReceiptView (parallel)
        └── Side-Pool Helper + OptionGroup validity Helper
```

Fire-Course (bestehend): Request-Body `course` wird Int; markiert ungefuerte Lines
dieser Nummer. Session-weites `hasFired` bleibt in Phase 1 unangetastet (Phase 3d).

## Test / Verifikation

- Migration auf Dev: bestehende Lines gemappt; KDS-Geräte-Filter Integer; Enum weg
- Nest: Order create + fire-course mit `course: 1|2|3`; Legacy `"main"` → 2 (Übergang)
- Bootstrap (Web): Item mit Side-Config zeigt `sides` + `sidePriceCents` in JSON
- Swift Unit: Decode Item mit Sides; `PosCourse` Int Codable; PaperReceipt Preview kompiliert
- Manuell: bestehende List-UI öffnet Session noch (Gang-Picker zeigt 1–3 Labels, bis Phase 2)

## Akzeptanzkriterien

1. Dev-DB hat `pos_order_lines.course` als `integer ≥ 1`; kein `pos_order_course`-Enum mehr
2. Nest + Web-Bootstrap + Swift sprechen Int-Gänge; Labels 1/2/3 stimmen
3. Bootstrap liefert Side-Preis/-Config; Swift decodiert; Side-Pool-Helper existiert
4. `PosDesign` exponiert die Token- und Text-Style-API; Paper-Bon-Shell mit Sägezahn
   in Preview nutzbar
5. OptionGroup min/max über Helper abfragbar; keine Regression am Pairing/Hub-Flow

## Risiken & Mitigations

| Risiko | Mitigation |
|--------|------------|
| KDS/Web-Admin sendet noch Enum-Strings | API akzeptiert Legacy-Map kurz; Admin-UI Courses auf Int umstellen im selben 1d-Task |
| Stale `database.types.ts` | Im 1d-Task mitziehen |
| Dual Bootstrap (Web vs Nest) | Beide Pfade Side-Felder + Int course in Phase 1 |
| Alte Handheld-Builds | LAN/Cloud: Int; alte String-Clients brechen — akzeptabel vor Pilot / App-Update |

## Nachfolger

- **Phase 2 Spec**: Order-Screen, Aktiver Gang, One-Tap, ModifierSheet, Hinweis 80 Zeichen
- **Phase 3 Spec**: Cart-Signatur/Merge, Papier-Bon-Inhalt, Fire-pro-Gang-State, Offline-Retry
- **Phase 4 Spec**: Liquid Glass, Timer amber 45 min; Custom-Fonts wenn lizenziert
