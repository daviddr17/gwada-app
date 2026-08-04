# POS Tisch-Überblick (Session Hub) — Design

**Datum:** 2026-08-03  
**Branch-Kontext:** `apps/pos` Kellner Swift (`TableSessionView`)  
**Status:** Draft zur Review

## Problem

Beim Öffnen eines laufenden Tisches landet der Kellner immer in der Speisekarte. Bei bestehenden Gängen und Teilzahlungen fehlt der Status auf einen Blick — unnötige Klicks, schlechter Überblick.

## Ziele

- Laufender Tisch mit Bon-Positionen → **Überblick zuerst**
- Speisekarte nur wenn bewusst **Bestellen**
- Kontextuelle Primäraktion: eher **Kassieren** / **Freigeben** als Bestellen
- Freier / leerer Bon → Verhalten **unverändert** (direkt Speisekarte)

## Nicht-Ziele (v1)

| Thema | Umgang |
|-------|--------|
| Letzte Bestellung wiederholen | Backlog Phase „Überblick+“ |
| Volle Historie bezahlter Positionen | Backlog; v1 nur Summe „Bereits kassiert“ |
| Neue Cloud-API nur für Overview | Kein Scope; lokale/`openLines`/Belege |
| Floor-Karten umbauen | Unverändert |

Out-of-scope-Punkte werden **nicht verworfen** — sie kommen in eine spätere Spec („Überblick+“), sobald v1 live und smoke-getestet ist.

## Entscheidungen (bestätigt)

| # | Entscheidung |
|---|--------------|
| A | Überblick nur wenn `openLines` nicht leer |
| B | Dock: offen € → Kassieren primär, Bestellen sekundär; alles bezahlt → Freigeben primär |
| C | Hybrid: offene Positionen als Liste + Stats; bezahlt nur als Summe |
| Nav | Ansatz 1: Phasen in `TableSessionView` (`overview` \| `ordering`) |

## Architektur

```text
TablesHome → TableSessionView
                 ├─ phase = overview   (wenn openLines nicht leer beim Einstieg)
                 └─ phase = ordering   (leer / Bestellen / freier Tisch)
```

- Eine View, interner `@State` / enum Phase
- Bestehende Sheets bleiben: Bon, Kassieren, Move, Configure
- Header (Status, Gäste, Summe) in beiden Phasen

### Einstieg

| Zustand | Startphase |
|---------|------------|
| `openLines.isEmpty` | `ordering` |
| `openLines` nicht leer | `overview` |
| Cart ungesendet, Bon leer | `ordering` |

### Overview-Layout (oben → unten)

1. Bestehender Session-Header  
2. Stats: **Offen X €** · optional **Bereits kassiert Y €**  
3. Liste nur **offener** Positionen (Name, offene Menge, Gang, offener Betrag)  
4. Gang-Kurzstatus (gefeuert / offen) aus bestehenden `firedAt` / Helpers  
5. Dock nach Option B  

Tipp auf Listenzeile: optional Bon öffnen (nicht Kassieren). Primär-Dock öffnet Kassieren / Freigeben / Bestellen.

### Phase `ordering`

- Wie heutige UI (Gang-Chips, Speisekarte, Bon-Dock)
- Toolbar **„Übersicht“** nur wenn `openLines` nicht leer → zurück zu `overview`

### Nach Aktionen

| Aktion | Ergebnis |
|--------|----------|
| Teilzahlung, Rest offen | `overview`, Liste refresh |
| Alles bezahlt | `overview` „Alles bezahlt“ + Freigeben primär |
| Freigeben | Floor (bestehend) |
| Bestellen → Bon senden | bleibt in `ordering`, bis Übersicht oder Tisch neu öffnen |

## Daten v1

- Offene Liste = `openLines`
- Offen € = Σ `openCents`
- Bereits kassiert Y:
  1. Partial auf noch offenen Zeilen: Σ (`settlementLineTotalCents − openCents`)
  2. Plus voll bezahlte Beträge aus lokalen Tisch-/Session-Belegen (`PosOfflineCaches`), soweit zuordenbar
  3. Sonst Y nur aus (1) — darf unterschätzen; kein Blocking für v1

Keine neue Settlement-API nur für diesen Screen.

## UI / a11y

- Bestehende POS-Komponenten (`PosButton`, `PosCardRow`, Dock-Muster)
- Accessibility-IDs: z. B. `pos.session.overview`, `pos.session.overview.order`, `pos.session.overview.collect`
- Kein doppelter Modultitel; Header bleibt Chrome

## Erfolgskriterien

1. Tisch mit offenen Positionen öffnet Überblick, nicht Speisekarte  
2. Freier Tisch / leerer Bon öffnet Speisekarte  
3. Bestellen zeigt Speisekarte; Übersicht führt zurück  
4. Bei offenem Betrag ist Kassieren die Primäraktion  
5. Offene Positionen sichtbar; bezahlt als Summe (nicht volle Historie)  
6. Unit/UITest: Startphase abhängig von `openLines`

## Follow-ups („Überblick+“)

1. Letzte Bestellung wiederholen  
2. Bezahlte Positionen als aufklappbare Historie  
3. Reichere „Bereits kassiert“-Quelle (Cloud-Summary), falls nötig  
4. Quick-Add / Favoriten vom Überblick
