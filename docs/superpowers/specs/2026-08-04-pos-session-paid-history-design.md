# POS Session-Historie (bezahlte Positionen) — Design

**Datum:** 2026-08-04  
**Status:** Approved  
**Bezug:** `2026-08-03-pos-table-overview-design.md`, `2026-08-03-pos-overview-course-sections-design.md`  
**Branch-Kontext:** `apps/pos` (`TableSessionView`, Überblick, Kassieren/Belege)

## Problem

Nach Kassieren sieht der Service nur noch offene Restmengen (oder die Speisekarte). Was der Gast **bereits bestellt und bezahlt** hat, fehlt — besonders nach Teilzahlung und wenn alles bezahlt ist (vor Freigeben).

## Ziele

1. Schnelle **Historie** = bezahlte Positionen dieser Session (bestellt/geschickt & kassiert).
2. **Start- und Zurück-Navigation** abhängig von offen vs. Historie (Speisekarte nur bei Neu/leer).
3. Teilzahlungen ehrlich: bezahlter Slice in Historie, Rest im Überblick.
4. Hub-Kassieren → Historie auch am Handgerät sichtbar.
5. Freigeben / Beleg-Storno halten Historie konsistent.

## Nicht-Ziele (v1)

| Thema | Umgang |
|-------|--------|
| Historie tippen öffnet Bon/Edit | Nein — read-only |
| Letzte Bestellung wiederholen | Weiter Backlog „Überblick+“ |
| Cloud-only API nur für Historie | Ableiten aus Belegen + Cache |
| Historie nach Freigeben am Tisch behalten | Nein |
| Segmented Control Offen\|Historie | Nein — Chip/Button |

## Entscheidungen (bestätigt)

| # | Thema | Wahl |
|---|--------|------|
| 1 | Inhalt | Bezahlte Positionen (A) |
| 2 | Teilzahlung | Bezahlter Slice in Historie, Rest offen (A) |
| 3 | Start / Zurück | Regeln A (siehe unten) |
| 4 | Einstieg Historie | Chip/Button „Historie“ (+ Badge) (A) |
| 5 | Historie-Dock | Bestellen + Kassieren bzw. Freigeben (A) |
| 6 | Daten | Beleg-Allokationen / Collect ableiten + kleiner Cache (A+) |
| 7 | Storno / Freigeben | Freigeben löscht; Storno nimmt Mengen raus (A) |
| 8 | UI | Gang-Sektionen wie Überblick (A) |
| 9 | Multi-Gerät | Hub-Collect → Handgerät sieht Historie (A) |
| 10 | Zeile tippen | Keine Aktion (read-only) |

## Phasen-Modell

Erweitere `PosSessionPhase`:

```text
overview | history | ordering
```

### Startphase (`startPhase`)

| Zustand | Phase |
|---------|--------|
| `openLines` nicht leer | `overview` |
| `openLines` leer **und** Historie nicht leer | `history` |
| beides leer (neuer / leerer Tisch) | `ordering` |

Ungeschickter Cart allein ändert die Startphase **nicht** (wie bisher: Speisekarte).

### Navigation

| Aktion | Ziel |
|--------|------|
| Überblick → „Bestellen“ | `ordering` |
| Überblick → „Historie“ (wenn Historie ≠ leer) | `history` |
| Historie → „Bestellen“ | `ordering` |
| Historie → zurück (Toolbar / wenn noch offen) | `overview` wenn offen, sonst bleibt `history` oder Freigeben |
| Nach Kassieren schließen | `overview` wenn noch offen, sonst `history` wenn Historie, sonst `ordering` |
| „Zurück“ / Übersicht aus Ordering | `overview` wenn offen; sonst `history` wenn Historie; sonst Floor-Back (kein Zwang Speisekarte) |
| Toolbar „Übersicht“ | nur sinnvoll wenn offen → `overview` |

**Kernregel:** Speisekarte ist Default **nur** ohne offene Pos. und ohne Historie. Nach Bestellen→Fire→Kassieren führt „zurück“ nicht mehr blind in die Speisekarte.

## UI

### Überblick (erweitert)

- Unverändert: Stats Offen / Bereits kassiert, Gang-Sektionen offene Zeilen, Dock Bestellen + Kassieren/Freigeben.
- **Neu:** Wenn Historie nicht leer → Chip/Button **„Historie“** (Badge = Anzahl bezahlter Positionszeilen oder Summe Mengen — konsistent wählen: **Anzahl Zeilen nach Merge**).
- Placement: Toolbar oder über der Liste (eine Stelle, shadcn/POS-Chrome analog Chip).

### Historie (`TableSessionHistoryView` o. ä.)

- Titel-Kontext über Modul-Chrome / Nav: Tisch bleibt Nav-Title; Inhalt ohne doppelten „Historie“-CardTitle wenn Chip reicht — oder kurzer Section-Kopf „Bezahlt“.
- Liste: Gruppierung nach **Gang** (wie Überblick).
- Zeile: `Menge× Name` · Betrag; Caption optional Uhrzeit der (letzten) Zahlung; Status-Hinweis „bezahlt“ nur wenn nötig (kein Lärm).
- Zeile **nicht** tappable (oder tap ohne Side-Effect).
- Dock: wie Überblick — **Bestellen** sekundär; bei `openCents > 0` **Kassieren · €** primär; bei `openCents == 0` **{Tisch} freigeben** primär.
- Wenn noch offene Pos.: Toolbar **„Übersicht“** zurück zu `overview`.

### Speisekarte

- Unverändert; Einstieg nur nach Regeln oben bzw. Bestellen.

## Datenmodell

### Historie-Zeile (Cache)

Abgeleitet, lokal cachebar pro `sessionId`:

```text
PaidHistoryLine
  id / stableKey          // z. B. menuItemId|course|signature oder receiptLine-Key
  menuItemId?
  name
  quantity                // kumuliert bezahlt
  amountCents             // kumuliert bezahlt
  course
  detail?                 // Mods/Notizen ohne redundantes Gang-Label
  lastPaidAt?
```

### Ableitung + Cache

1. **Quelle der Wahrheit:** Session-Belege (`PosLocalReceipt` mit `tableSessionId`, Status paid, nicht void) → Items/Allokationen.
2. **Kleiner Cache:** `PosLocalStore` / Hub-State Map `sessionId → [PaidHistoryLine]`, beim erfolgreichen Collect **append/merge** (Teilzahlung: Mengen addieren, gleicher Signature-Key mergen).
3. **Rebuild:** Beim Öffnen der Session Cache aus Session-Receipts neu aufbauen (Handgerät nach Snapshot/Collect), damit Hub-Kassieren sichtbar wird.
4. **Storno:** Voided Receipt → Rebuild ohne diesen Beleg (Mengen verschwinden aus Historie).
5. **Freigeben:** Cache-Key `sessionId` löschen (wie Draft-Cart / Open-Lines).

Teilzahlung: Collect mit qty=1 von open=2 → Historie +1; `openLines` behält 1.

## Implementierungs-Skizze

| Bereich | Änderung |
|---------|----------|
| `PosSessionPhase` | `+ history` |
| `PosSessionOverviewMath.startPhase` | `(openLines, historyNonEmpty) → phase` |
| Neu: `PosSessionPaidHistory` Math + Cache | derive/merge/rebuild/clear |
| `TableSessionOverviewView` | Historie-Chip |
| Neu: `TableSessionHistoryView` | Liste + Dock |
| `TableSessionView` | phase wiring, post-Kassieren phase, Toolbar |
| Collect / void / release | Cache update / rebuild / clear |
| Tests | startPhase-Matrix; merge Teilzahlung; void rebuild; UITest smoke optional |

## Akzeptanzkriterien

1. Neuer Tisch ohne Pos./Historie → Speisekarte.
2. Nach Schicken mit offenen Pos. → Überblick zuerst.
3. Teilzahlung → bezahlte Menge in Historie, Rest im Überblick; Chip „Historie“ sichtbar.
4. Alles bezahlt, Session noch offen → Start/Zurück in **Historie**; Freigeben im Dock.
5. Überblick + Historie → Chip öffnet Historie; Übersicht zurück wenn noch offen.
6. Ordering „Übersicht“/Zurück → Überblick oder Historie nach Regeln, nicht Speisekarte wenn Historie/offen.
7. Kassieren am Hub → Handgerät zeigt Historie nach Refresh/Snapshot.
8. Freigeben → Historie weg; nächster Besuch leerer Tisch → Speisekarte.
9. Beleg stornieren → betroffene Historie-Mengen weg / Rebuild korrekt.

## Out of scope / später

- Repeat last order, Upsell, bezahlte Pos. erneut bestellen.
- Cloud-API nur für History-Feed.
- Tippen auf Historie-Zeile öffnet Gastbeleg (optional später).
