# POS Order-UI (Phase 3) — Bon + Küche Design Spec

Stand: 2026-07-30. Baut auf Phase 1–2 auf. Liefergegenstand: Bon-Sheet,
Cart-Signatur/Merge, Fire-pro-Gang, Offline-Retry mit vollem Payload.

## Ziel

Nach der Bestellaufnahme (Phase 2) braucht der Kellner einen klaren Ort für
Review → Senden → Küchen-Fire, ohne die Speisekarte zu blockieren. Ungesendete
Positionen leben im Bon; die Session zeigt nur noch gesendete Open-Lines.

## Scope

Phase 3 umfasst exakt:

- **3a** Cart-Zeile: Beilagen in der Signatur + stabile Modifier-Signatur.
- **3b** Merge identisch konfigurierter Positionen (quantity += 1).
- **3c** Bon-Sheet (Papier): Gang-Gruppierung, ±/Gang-Wechsel nur ungesendet,
  Summe, „Weiter bestellen“ | „Zur Rechnung“.
- **3d** Fire-pro-Gang: Button pro offenem ungefeuertem Gang; Fire-State
  pro Session+Gang; `firedAt` in Summary/Open-Lines.
- **3e** Offline-Retry: `course` / `modifiers` / `ohneIngredientIds` bleiben
  beim Requeue erhalten.

Nicht in Scope (Phase 4 / später):

- Liquid Glass / iOS-26 Tab-Accessory
- Timer amber ab 45 min
- Neuer Beleg/TSE-Flow (Kassieren bleibt `SplitPayView`)
- DB-Schema-Migration (kein neues Feld nötig; höchstens DTO/`firedAt`-Mapping)

## Feste Produktentscheidungen

| Thema | Entscheidung |
|-------|----------------|
| Bon-Platzierung | Sheet vom Dock („Bon öffnen“), Speisekarte bleibt Hauptfläche |
| Senden | Nur im Bon; Session-Button „Bestellung senden“ entfällt |
| Fire | Nur im Bon, pro Gang; oranger Session-„Fire“ entfällt |
| Session-Liste | Nur **gesendete** Open-Lines; lokaler Cart nur im Bon (+ Dock-Badge) |
| Zur Rechnung | Bon schließen → bestehendes `SplitPayView` |
| Weiter bestellen | Bon schließen, zurück zur Speisekarte |
| Abort-Gate | Blockiert, sobald **irgendein** Gang der Session gefeuert wurde |
| Beilagen im Cart | Bereits als Modifier `type: "side"` (`optionChoiceId` = Side-Item-ID); Signatur bezieht sie ein |
| Fonts | Weiter System-Fonts |

## Architektur (Bon-zentriert)

```
TableSessionView
  ├─ Speisekarte (Phase 2) → schreibt in lokalen `cart`
  ├─ Open-Lines (nur gesendet, read-mostly)
  ├─ Dock: Bon-Button + Badge(cart qty)
  └─ sheets:
       ├─ BonSheetView(cart binding, openLines, send, fire, ±)
       └─ SplitPayView (via „Zur Rechnung“)
```

`PosRuntime.sendCart` / `fireCourse` bleiben die Sync-Einstiege; UI ruft sie
nur noch aus dem Bon auf.

## 3a / 3b — Cart-Signatur & Merge

### Modell

`PosCartLine` behält `modifiers` (inkl. `side`). Ergänzung:

- `configurationSignature: String` (computed oder gespeichert, muss Equatable-stabil sein)

Signatur-Eingaben (kanonisch sortiert):

1. `menuItemId`
2. `course`
3. Modifier-IDs (bereits stabil: `ohne-…`, `opt-…`, `side-…`)
4. getrimmte `notes` (leer = kein Notes-Segment)

Keine parallele `sideMenuItemIds`-Liste — **eine Quelle**: Side-Modifiers
(`type == "side"`). Signatur nutzt deren IDs.

### Merge

Beim One-Tap und nach Modifier-Sheet-Confirm:

- Existiert Cart-Zeile mit gleicher Signatur → `quantity += 1` (bzw. += sheet qty).
- Sonst neue Zeile anhängen.

Gang-Wechsel einer ungesendeten Zeile im Bon ändert `course` und damit die
Signatur; Merge mit einer bestehenden Ziel-Gang-Zeile gleicher Rest-Config ist
erlaubt (Mengen addieren, Quellzeile entfernen).

## 3c — Bon-Sheet UX

### Dock

- Primäraktion: „Bon“ (Icon + Label).
- Badge = Summe `quantity` im lokalen Cart; bei 0 kein Badge.
- Leerer Cart: Bon trotzdem öffenbar (zeigt nur gesendete Open-Lines / Fire).

### Inhalt (`PaperReceiptView`)

- Header: Tischlabel, Gäste wenn bekannt, Gesamtsumme (Cart + optional Open).
- Sektionen Gang 1 → 3 (nur Gänge mit Inhalt).
- Pro **ungesendeter** Zeile: Name, Modifier-Unterzeile, ±, Gang-Wechsel (↻),
  Preis; qty 0 entfernt die Zeile.
- Pro **gesendeter** Open-Line: read-only; Kennzeichnung gefeuert vs. wartend
  (über `firedAt` / lokalen Fire-State).

### Aktionen

| Aktion | Verhalten |
|--------|-----------|
| Senden · Summe | `sendCart` mit aktuellem Cart; bei Erfolg Cart leeren, Open-Lines refreshen |
| {Gang} schicken | `fireCourse(session, course)` wenn ungefeuerte Open-Lines dieses Gangs existieren |
| Weiter bestellen | Sheet dismiss |
| Zur Rechnung | Sheet dismiss → `SplitPayView` |

### Session-Chrome-Änderungen

- Entfernen: „Bestellung senden“, oranger „Fire“.
- Behalten: Freigeben / Abbruch (Abort nur wenn kein Fire auf der Session).
- Oberer Cart-Block für ungesendete Zeilen entfällt; leerer Zustand verweist
  auf Speisekarte + Bon.

## 3d — Fire-pro-Gang

### Lokal

`PosHubState`:

- Von `firedSessionIds: Set<String>` zu
  `firedCoursesBySession: [String: Set<Int>]` (oder äquivalent).
- `markFired(sessionId:course:)`
- `hasFired(sessionId:)` = Set nicht leer (Abort-Gate).
- `hasFired(sessionId:course:)` für Button-Disable / Label.

### Cloud / Summary

- DB-Spalte `pos_order_lines.fired_at` ist vorhanden und wird im Nest-Select
  schon gelesen.
- Swift `PosCloudSessionSummaryLine` / `SessionOpenLine` um:
  - `course: Int` (für Bon-Gruppierung und Fire-Buttons; heute oft nur im Detail-String)
  - `firedAt: Date?` (ISO vom Summary)
- Mapping-Layer (Nest/Web → Client-DTO), falls Summary `fired_at` verwirft:
  Feld durchreichen — **keine** DB-Migration.

### Backend

`orders.service.ts#fireCourse` bleibt die Quelle der Wahrheit (setzt
`fired_at` für ungefeuerte Lines des Gangs). Kein API-Vertragsbruch erwartet;
Payload hat bereits `course: number`.

## 3e — Offline-Retry

Bug heute (`PosRuntime.sendCart` Catch): Queue speichert nur
`menuItemId` / `quantity` / `notes` — Gang und Modifier gehen verloren.

Fix:

1. `PosSyncOrderItem` um `course`, `modifiers`, `ohneIngredientIds` erweitern
   (Codable, rückwärtskompatibel decode mit Defaults).
2. Catch-Pfad enqueued denselben Inhalt wie erfolgreiches `PosCloudOrderItem`.
3. Flush/Nest-Envelope für `order.created` (bzw. bestehender Typ) sendet die
   neuen Felder mit — bestehendes Nest-Create-Order akzeptiert sie bereits.

## Fehlerbehandlung

- Offline-Enqueue nach Send-Fehler: weiterhin `return true` → UI leert den
  Cart (lokales Commit wie heute); Status „Lokal gebucht — Sync später“.
- Fire ohne Session: `ensureSessionId` wie bisher.
- Fire ohne ungefeuerte Lines: Button disabled / no-op + kurzer Status.

## Testing

- **Unit:** Signatur-Stabilität (Reihenfolge Modifier/Sides irrelevant);
  Merge; Gang-Wechsel-Merge; `PosSyncOrderItem` round-trip inkl. Modifier;
  `hasFired` pro Gang vs. Session.
- **UITest-Smoke:** Tisch öffnen → Item → Bon-Badge ≥ 1 → Bon-Sheet Titel/Papier
  sichtbar (Fire/Senden-Happy-Path optional manuell, wenn Hub/Cloud flaky).

## Datei-Anker

| Bereich | Dateien |
|---------|---------|
| Cart | `apps/pos/Sources/Cart/PosCartModels.swift` |
| Session UI | `apps/pos/Sources/UI/TableSessionView.swift` |
| Neu Bon | `apps/pos/Sources/UI/BonSheetView.swift` (o.ä.) |
| Papier | `apps/pos/Sources/UI/PaperReceiptView.swift` |
| Runtime/Sync | `PosRuntime.swift`, `PosSyncQueue.swift`, `PosHubState.swift` |
| Open lines | `SessionOpenLine.swift`, `PosCloudClient.swift` Summary-DTOs |
| Nest Fire | `apps/pos-api/src/orders/orders.service.ts` |
| Nest Summary | `apps/pos-api/src/sessions/sessions.service.ts` |

## Erfolgskriterien

1. Ungesendete Positionen sind nur im Bon editierbar; Badge stimmt.
2. Identische Config merged; unterschiedliche Notes/Sides/Options nicht.
3. Senden + Fire nur aus dem Bon; Session-Leiste ohne Doppel-CTAs.
4. Fire markiert nur den gewählten Gang; Abort blockiert nach erstem Fire.
5. Offline-Requeue behält Course + Modifier.
6. „Zur Rechnung“ öffnet bestehendes Split/Pay.

## Abgrenzung Phase 4

Liquid Glass Tab-Accessory „Bon öffnen“, Status-Timer amber, Custom-Fonts —
nicht Teil dieser Spec.
