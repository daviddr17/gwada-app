# POS Überblick Gang-Sektionen + Cart-Badges + Entwurf leeren — Design

**Datum:** 2026-08-03  
**Status:** Approved  
**Bezug:** `2026-08-03-pos-table-overview-design.md`

## Ziele

1. Überblick: offene Positionen nach Gang **sektioniert** erkennbar.
2. Speisekarte: Badges nur für **ungeschickten Entwurf** (Cart).
3. Bon-Sheet: **Entwurf leeren** für den gesamten ungeschickten Warenkorb.

## Entscheidungen

| Thema | Wahl |
|-------|------|
| Überblick-Gruppierung | Sektionen mit Kopf „Gang N · geschickt/offen“ |
| Speisekarte-Badges | Nur `cart`; keine openLines |
| Entwurf entfernen | Bon-Sheet: Einzel-Stepper + „Entwurf leeren“ (+ Alert bei >1 Pos.) |

## Verhalten

### Überblick (`TableSessionOverviewView`)

- Gruppiere `openLines` nach `course` (aufsteigend).
- Sektionskopf = gleicher Status-Text wie bisherige Course-Chips (`PosSessionOverviewMath.courseStatuses` / `courseNeedsFire`).
- Horizontale Chip-Leiste oben **entfernen** (Info steckt in den Sektionsköpfen) — vermeidet Doppelung.
- Zeilen: Menge × Name, Detail nur Mods/Notizen — **kein** Gang-Label aus `detail`, wenn es nur der Course-Name ist. Praktisch: `detail` anzeigen, sofern nicht leer und nicht identisch mit `PosCourse.label(course)`.

### Speisekarte

- `TableSessionView.quantityForMenuItem` → nur Cart-Summe für `menuItemId`.

### Bon-Sheet

- Wenn `cart` nicht leer: Button **„Entwurf leeren“**.
- `cart.count > 1` oder Gesamtmenge > 1 → Confirm-Alert; sonst direkt leeren.
- Stepper −/+ unverändert.

## Out of scope

Mehrfachauswahl, „bereits bestellt“ auf der Karte, API/Schema, Floor.

## Erfolgskriterien

1. Überblick zeigt getrennte Gang-Blöcke mit Status-Kopf.
2. Nach Schicken verschwindet Badge auf der Karte; nur neue Cart-Mengen badgen.
3. „Entwurf leeren“ leert den Cart; Stepper kann einzelne Stücke entfernen.
