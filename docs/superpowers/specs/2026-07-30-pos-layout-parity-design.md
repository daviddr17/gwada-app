# POS Layout-Parity — Design Spec

Stand: 2026-07-30. Baut auf Order-UI Phasen 1–4 und dem Review
`docs/superpowers/2026-07-30-prototyp-vs-app-review.md` auf.

**Kassieren/Split bleibt pausiert** — diese Spec schließt nur Layout- & Flow-Chrome-Lücken
zwischen Kellner-Prototyp und Swift-App.

## Ziel

Tischplan und Bestellaufnahme sollen sich **layout- und flow-mäßig** wie der Prototyp
anfühlen (große Tischnummern, Status-Punkte, Menü-first, ein Daumen-Dock, Gäste ±,
Tab-Bar in der Session weg), ohne das bestehende Bon-/Send-/Fire-Modell umzubauen.

## Theme (verbindlich)

| Thema | Entscheidung |
|-------|----------------|
| Erscheinungsbild | **Light und Dark** (system `ColorScheme`) |
| Default | **Light** — Design-Baseline und Review-Screenshots in Light |
| Kein Forced-Dark | Prototyp-Dunkelgrün ist **nur Dark-Mode-Palette**, nicht App-Default |
| Accent/CTA | Brass/Gold analog Briefing, in Light und Dark lesbar |
| Surfaces | Semantische Tokens in `PosDesign` (bg / surface / surface2 / line / ink / muted / brass / paper / green) — **adaptive Paare** |
| System-Chrome | Navigation/TabBar nutzen App-Tokens soweit sinnvoll; kein paralleles Design-System |
| Fonts | Weiter **System-Fonts** (Custom-Fonts eigene Spec) |

### Token-Richtung (Light / Dark)

Light (Baseline): warmes Off-White/Cream für bg/surface, dunkles Ink, Brass-CTA, Paper für Bon.  
Dark: Briefing-Nähe (`#101B16` / `#18261F` / Elfenbein-Ink / Brass) — adaptive `Color`/`UIColor` Paare, keine hardcodierte Dark-Only-App.

Status-Punkte (beide Modes): frei · besetzt · bestellt · serviert · zahlt · bezahlt — Farben aus Briefing, in Light leicht abgedunkelt falls Kontrast fehlt.

## Scope

### In Scope (Layout-Parity)

1. **LP-Theme** — Adaptive Tokens flächendeckend auf Kellner-Floor / Session / Menu / Bon Dock (nicht nur definieren).
2. **LP-Floor** — Tischplan: große Display-Nummer, Status-**Punkt** (nicht nur Frei/Besetzt-Badge), Timer, Gäste, offene Summe; Header Restaurant-Name + optionale Station; Status-Legende; Amber ≥45 unverändert (Timer+Rand).
3. **LP-Order** — Session Menü-first; Gang-Chips „Neue Artikel auf Gang 1–3“ (numerisch, nicht Vorspeise/Hauptgang/Dessert als Primärlabel); Tab-Bar in Session **hidden**; ein Primär-Dock „Bon öffnen · N neu · Summe“; Freigeben/Abbruch sekundär darüber oder im Overflow; Gäste ± im Header; sent-lines kompakt oder hinter Bon (kein großer Empty-State als Hauptfläche).
4. **LP-Bon** — Copy/Chrome an Prototyp-CartSheet angleichen (GANG-Gruppen, ±/↻ wo schon vorhanden, Senden / Weiter bestellen / Zur Rechnung); Papier-Look behalten.

### Nicht in Scope

- Kassieren / SplitPay-Redesign / Person-Dock / Gleich-teilen-Server
- Custom-Fonts
- Reservierungen-Timeline-Feinschliff (P2)
- Schichtübergabe / Owner-Badge am Floor (P2)
- Schema-/API-Migrationen
- Deployment-Target > 17.0
- Hub-iPad-Modul-Chrome (außer geteilte Tokens)

## Feste Produktentscheidungen

| Thema | Entscheidung |
|-------|----------------|
| Gang-UI | Primär **„Gang 1|2|3“**; semantische Labels nur sekundär/a11y ok |
| Tab-Bar in Session | `.toolbar(.hidden, for: .tabBar)` (oder äquivalent) solange `TableSessionView` oben |
| Bon-Einstieg | **Ein** prominenter Dock-CTA; iOS-26 Accessory **darf bleiben** (gleicher Opener), aber kein zweiter gleichwertiger Primary-Button-Stapel |
| Gäste | Stepper ± ändert Session-Gästezahl (bestehende Runtime/API nutzen falls vorhanden; sonst klarer Follow-up-Task im Plan) |
| Bezahlt-Status | Punktfarbe `bezahlt` wenn Session bezahlt/offen=0 und noch nicht freigegeben — nur wenn State bereits verfügbar; sonst Floor weiter Frei/Besetzt + bestellt-Heuristik aus openCents/fired |
| Search am Floor | Darf bleiben, aber **nicht** dominant vor Display-Nummern (kompakter) |

## Architektur

```
PosDesign
  ├─ adaptive semantic colors (Light/Dark)
  ├─ statusDot(for: TableVisualStatus)
  └─ existing amber helpers (unchanged rules)

TablesHomeView
  └─ floor cards: big label, status dot, timer, guests, sum

TableSessionView
  ├─ hide tab bar
  ├─ header: back implicit, table, timer, move, guests ±
  ├─ "Neue Artikel auf" + Gang 1–3 chips
  ├─ MenuBrowserView fills remaining space (menu-first)
  └─ thumb dock: secondary release + primary „Bon öffnen · N · €“

BonSheetView
  └─ paper chrome + prototyp-aligned course groups / CTAs
```

## Erfolgskriterien

1. Light Mode: Floor und Order wirken wie Service-UI (große Nummern, Punkte, Menü-first, ein Dock) — nicht wie generisches System-Settings-Grid.
2. Dark Mode: dieselben Layouts, dunkle Briefing-nahe Surfaces, lesbare Kontraste.
3. In Tisch-Session: Tab-Bar unsichtbar; Zurück zeigt wieder Tabs.
4. Gang-Chips numerisch; Bon-Dock zeigt Menge + Summe.
5. Phase-3 Smoke (Pair → Tisch → Bon → Senden → Rechnung) bleibt grün.
6. Keine Änderung an SplitPay-Logik.

## Datei-Anker

| Bereich | Dateien |
|---------|---------|
| Tokens | `apps/pos/Sources/UI/PosDesign.swift` (+ ggf. Asset Catalog) |
| Floor | `apps/pos/Sources/UI/TablesHomeView.swift` |
| Session | `apps/pos/Sources/UI/TableSessionView.swift` |
| Menu | `apps/pos/Sources/UI/MenuBrowserView.swift` |
| Bon | `apps/pos/Sources/UI/BonSheetView.swift` |
| Root/Tabs | `apps/pos/Sources/UI/RootView.swift` |
| Tests | `apps/pos/Tests/GwadaPOSTests/`, optional UITest Smoke |

## Abgrenzung Nachfolger

- **Kassieren-Spec** (pausiert) nach Layout-Parity  
- **Fonts-Spec** wenn Lizenzdateien vorliegen  
- Reservierungen / Schichtübergabe eigene Specs
