# POS Order-UI (Phase 2) — Bestellaufnahme Design Spec

Stand: 2026-07-30. Baut auf Phase 1 (1a-1f) auf und liefert die neue
Bestellaufnahme-UX auf iPhone/iPad in `apps/pos`.

## Ziel

Die Bestellaufnahme soll vom aktuellen Listenfluss auf den neuen,
service-orientierten Order-Flow wechseln: schneller Zugriff auf Artikel,
klarer aktiver Gang, One-Tap-Bonieren ohne unnötige Dialoge und
valide Modifier/Beilagen-Konfiguration.

## Scope

Phase 2 umfasst exakt:

- **2a** Order-Screen mit 2-Spalten-Raster, Kategorie-Chips, Mengen-Badges,
  Header-Aktionen und Einhand-Dock.
- **2b** Aktiver Gang 1-3 als primärer Kontext für neue Positionen.
- **2c** One-Tap-Bonieren: direkte Aktion für Artikel ohne Modifier.
- **2d** Modifier-Sheet mit Pflicht/Max-Erzwingung und Live-Preis.
- **2e** Beilagen-Grid (Side-Pool aus Kategorie "Beilagen") im Modifier-Sheet.
- **2f** Küchen-Hinweis pro Position (max. 80 Zeichen).

Nicht in Scope (bleibt Phase 3/4):

- Bon-Sheet-Logik (Gang-Gruppierung, Weiter bestellen/Zur Rechnung)
- Fire-pro-Gang-UI/State
- Cart-Merge nach Modifier-Signatur
- Liquid-Glass/iOS-26-Politur

## Feste Produktentscheidungen

- Gänge bleiben numerisch (`1..3` in UI, backendseitig `>= 1`).
- `side/drink/other` bleiben entfernt; Positionen tragen den aktiven Gang.
- Beilagen kommen aus dem bestehenden Side-Pool-Path (Phase 1e).
- Fonts bleiben vorerst System-Fonts; kein Font-Embedding in Phase 2.

## UX-Anforderungen

### 2a Order-Screen

- Primäre Fläche: Artikelraster (2 Spalten), scrollbar, schnelle Tap-Zyklen.
- Sichtbarer Kontext: Tischname, Gästezahl, aktueller Gang, Summenhinweis.
- Kategorie-Chips filtern Artikel sofort, ohne Full-Reload.
- Mengen-Badge auf Kacheln zeigt bereits im Warenkorb befindliche Anzahl.
- Einhand-Dock bleibt am unteren Rand erreichbar (inkl. Cart-Öffnen).

### 2b Aktiver Gang

- Globale, sichtbare Steuerung (`1`, `2`, `3`) im Session-Kontext.
- Neue Positionen übernehmen immer den aktiven Gang.
- Gangwechsel verändert keine bereits angelegten Positionen.

### 2c One-Tap-Bonieren

- Artikel ohne Optionen/Beilagen: ein Tap = sofort als Position im Cart.
- Artikel mit Optionen/Beilagen: ein Tap öffnet Modifier-Sheet.

### 2d Modifier-Sheet

- Zeigt Option-Gruppen mit `minSelect`/`maxSelect`-Regeln.
- CTA ist nur aktiv, wenn alle Pflichtbedingungen erfüllt sind.
- Preis aktualisiert live (`Basis + Options + Beilagen`).
- Bei Max-Limit klare UI-Rückmeldung (weitere Auswahl blockiert).

### 2e Beilagen-Grid

- Beilagen als eigener Bereich im Sheet, gespeist aus Side-Pool.
- Anzeige von Side-Preis und inkludierter Menge (`includedCount`) vorbereitet.
- Auswahlmodell kompatibel mit späterer Bon-/Fire-Logik (Phase 3).

### 2f Küchen-Hinweis

- Optionales Freitextfeld pro Position, max. 80 Zeichen.
- Zeichenlimit live sichtbar.
- Hinweis wird im Cart-State gespeichert und in bestehende Payloads übernommen.

## Technischer Rahmen (High-Level)

- UI-Schwerpunkt in:
  - `apps/pos/Sources/UI/TableSessionView.swift`
  - `apps/pos/Sources/UI/MenuBrowserView.swift`
  - `apps/pos/Sources/UI/LineConfigureSheet.swift`
- Modelle/State:
  - `apps/pos/Sources/Cart/PosCartModels.swift`
  - `apps/pos/Sources/Menu/PosMenuSidePool.swift`
- Keine Schemaänderung zwingend für Phase 2 erwartet
  (DB-Fundament bereits in Phase 1 gelegt).

## Akzeptanzkriterien

1. Neue Position ohne Modifier kann in einem Tap hinzugefügt werden.
2. Modifier-Sheet erzwingt `minSelect`/`maxSelect` korrekt.
3. Beilagenauswahl ist im Sheet verfügbar und wird im Cart persistiert.
4. Aktiver Gang ist sichtbar und steuert neue Positionen.
5. Küchen-Hinweis (80 Zeichen) wird pro Position gesetzt und gespeichert.
6. Pairing-/Hub-Flow bleibt unverändert stabil (keine Regression).

## Risiken

- **Komplexität im Session-State:** parallele Änderungen an Cart, Sheet und Gang-Kontext.
- **UX-Tempo:** viele Re-Renders bei Grid + Badge + Live-Preis.
- **Regelkonflikte:** Pflicht/Max und Beilagenlogik müssen klar priorisiert sein.

## Nächster Schritt

Auf Basis dieser Spec: detaillierter Phase-2-Implementierungsplan mit
Tasks 2a-2f, Verifikationsschritten (Build/UITests) und klaren File-Slices.
