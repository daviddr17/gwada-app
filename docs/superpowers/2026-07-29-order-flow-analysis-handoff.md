# Kellner Order-Flow — Analyse & Task-Aufstellung (Handoff)

Stand: 2026-07-29. Vorarbeit für den nächsten Agenten. **Noch kein Code — nur Analyse + Entscheidungen + Task-Zuschnitt.**

Referenz-Prototyp: `/Users/fadihanna/Downloads/files-4/kellner-app-prototyp.jsx` + `.../kellner-app-briefing.md`.

## Kontext
- Schritt 3 (iPhone-Pairing) ist **fertig + verifiziert** — 17 unpushed Commits auf `cursor/kellner-swift-plan-main-3483`, Ledger: `.superpowers/sdd/progress.md`, Spec/Plan: `docs/superpowers/specs|plans/2026-07-28-iphone-pairing-approval*`.
- Ziel jetzt: Tisch-/Bestell-Flow **analog zum Prototyp** + Karte (Menü) anpassen.

## Ist vs. Prototyp — Kernlücken (Evidenz siehe Gap-Map in der Session)
- Beilagen: DB hat `menu_item_side_config` + `menu_items.side_price_cents`, aber **Bootstrap-API liefert sie nicht** → erreichen die App nie. Kein „Beilage↔Hauptgericht"-Modell.
- Optionsgruppen: Modell hat min/max/priceDelta, aber `LineConfigureSheet` **erzwingt Pflicht/Max nicht** (flache Toggles).
- Gang/Course: serverseitig granular (`pos_order_lines.fired_at` pro Zeile), Handheld feuert nur hart `"main"` — **kein Gang-Picker / kein „Gang X schicken" pro Gang**.
- Kein Merge identisch konfigurierter Positionen (Modifier-Signatur fehlt überall).
- Aktuelle UI = System-Liste + rotes Theme; Prototyp = 2-Spalten-Raster, dunkelgrün/messing, Papier-Bon, Einhand-Dock.

## Entscheidungen (vom User bestätigt)
1. **Voll-Design-System** (Briefing §2): dunkelgrün/messing, Papier-Bon, Fonts (Bricolage Grotesque / Instrument Sans / Spline Sans Mono), Status-Punkt-Farben, Liquid-Glass-TabView.
2. **Numerische Gänge 1–3** (statt semantischer Enum) → DB-Migration `pos_order_lines.course` + Backend + Swift.
3. **Beilagen = alle Items der Kategorie „Beilagen"** pro Hauptgericht mit Side-Config (wie Prototyp). `sidePrice`/`includedCount` vorbereitet, aber **vorerst voller Preis**.
4. **Scope endet bei „Zur Rechnung"** — Kassieren/Split bleibt vorerst unverändert (kein Beleg/TSE in dieser Runde).

## Reihenfolge & Tasks (S/M/L = grobe Größe)

**Phase 1 — Fundament**
- 1a Design-Tokens in `PosDesign` (bg/surface/surface2/line/ink/muted/brass/paper/green + Status-Punkte). *S*
- 1b Fonts einbetten + Text-Styles (Display/Body/Mono-tabular). ⚠️ **braucht lizenzierte Font-Dateien** (offen: hat User sie? sonst System-Font-Platzhalter). *S*
- 1c Wiederverwendbare Papier-Bon-View (Sägezahn, Paper-Farben) — für Bon + späteren Gastbeleg. *M*
- 1d Gänge numerisch: DB-Migration `course`→Int, `apps/pos-api` + Sync + Swift `PosCourse`→numerisch. *M*
- 1e Menü-Datenpfad Beilagen: Bootstrap-API `sidePriceCents` + `menu_item_side_config` pro Item ausliefern; Beilagen-Kategorie als Side-Pool; Swift-Modell (`PosCloudMenuItem`/`PosCloudMenuCatalog`) + LAN-Snapshot decodieren. *M*
- 1f Optionsgruppen min/max im Swift-Modell durchreichen (Daten vorhanden). *S*

**Phase 2 — Bestellaufnahme**
- 2a Order-Screen: 2-Spalten-Raster, Kategorie-Chips, Mengen-Badges, Header (⇄/🧾/Gäste-Stepper), Reservierungs-Warnung, Einhand-Dock. *L*
- 2b „Aktiver Gang" 1–3 vor dem Bonieren. *S*
- 2c One-Tap-bonieren (ohne Modifier sofort, sonst Sheet). *S*
- 2d ModifierSheet: Options-Chips **mit Pflicht/Max-Erzwingung** + Live-Preis + „Hinzufügen · Preis". *M*
- 2e ModifierSheet Beilagen-Grid (alle Beilagen-Items, sidePrice-Anzeige, inkl.-Logik vorbereitet). *M*
- 2f Küchen-Hinweis pro Position (80 Zeichen). *S*

**Phase 3 — Bon + Küche**
- 3a Cart-Zeile: Beilagen-Felder + Modifier-Signatur. *S*
- 3b Merge identisch konfigurierter Positionen. *S*
- 3c Bon-Sheet (Papier): nach Gang gruppiert, ±/Gang-wechsel (↻) nur ungesendet, Summe, „Weiter bestellen"|„Zur Rechnung". *M*
- 3d Fire-pro-Gang: „Gang X schicken" pro offenem Gang → Backend (unterstützt es), Fire-State pro Gang statt Session. *M*
- 3e Offline-Retry-Fix: Gang/Modifier gehen beim Requeue nicht verloren (bestehender Bug, `PosRuntime.sendCart` ~628-639). *S*

**Phase 4 — Politur**
- 4a Liquid-Glass-TabView (Standard iOS 26, `tabViewBottomAccessory` „Bon öffnen"). *S*
- 4b Status-Punkte/Timer-Feinschliff (ab 45 min amber). *S*

## Empfohlener nächster Schritt
Spec → Implementierungsplan → Subagent-Ausführung (wie beim Pairing), **Phase für Phase** (Phase 1 zuerst). Vor Phase 1 die Font-Frage klären.

## Wichtige Datei-Anker (Ist-Zustand)
- Order-UI: `apps/pos/Sources/UI/{TableSessionView,MenuBrowserView,LineConfigureSheet,KdsView}.swift`
- Cart-Modell: `apps/pos/Sources/Cart/PosCartModels.swift` (`PosCartLine`, `PosCartModifier`, `PosCourse`)
- Menü-Modell: `apps/pos/Sources/Cloud/PosBootstrapModels.swift` (`PosCloudMenuItem/Catalog/OptionGroup`)
- LAN-Snapshot-Menü: `apps/pos/Sources/LAN/PosLanModels.swift` (`PosLanHubSnapshot.menu`)
- Bootstrap-API: `apps/web/lib/pos/pos-bootstrap-server.ts`, `apps/web/app/api/pos/bootstrap/route.ts`
- Beilagen-DB/Admin: Migration `20260724120300_menu_item_side_config.sql`; `apps/web/components/pos/pos-menu-side-config-panel.tsx`; `apps/web/lib/pos/pos-menu-side-config-server.ts`
- Optionsgruppen-DB/Admin: Migration `20260716161000_menu_option_groups.sql`; `apps/web/components/menu/menu-option-group-drawer.tsx`
- Gang/Fire-DB/Backend: Migrationen `20260716180000_pos_cart_courses_kds.sql`, `20260724120500_pos_sync_events_and_line_fired.sql`; `apps/pos-api/src/orders/orders.service.ts#fireCourse`
