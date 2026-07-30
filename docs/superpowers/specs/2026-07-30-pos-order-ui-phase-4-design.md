# POS Order-UI (Phase 4) — Politur Design Spec

Stand: 2026-07-30. Baut auf Phase 1–3 auf. Liefergegenstand: Liquid-Glass
Tab-Accessory „Bon öffnen“ (iOS 26+) und Session-Timer Amber ab 45 Minuten.

## Ziel

Kellner-UX feinschleifen: auf iOS 26 den Bon schneller aus der Session erreichen
(Tab-Accessory), und lange laufende Tisch-Sessions auf der Übersicht besser
sichtbar machen (Amber ab 45 Min), ohne das Bestell-/Bon-Modell aus Phase 3
umzubauen.

## Scope

Phase 4 umfasst exakt:

- **4a** Liquid Glass / `tabViewBottomAccessory` „Bon öffnen“ (iOS 26+ only,
  mit Fallback).
- **4b** Status-Timer / Karten-Rand Amber ab 45 Minuten Session-Dauer.

Nicht in Scope:

- Custom-Fonts / Font-Embedding
- Deployment-Target-Erhöhung auf iOS 26
- Globales Tab-Accessory außerhalb der Tisch-Session
- Änderungen an Senden/Fire/SplitPay-Logik
- Schema-/API-Migrationen

## Feste Produktentscheidungen

| Thema | Entscheidung |
|-------|----------------|
| iOS-Target | Bleibt **17.0**; Glass/Accessory hinter `#available(iOS 26, *)` |
| Bon-Accessory | Nur sichtbar, wenn Navigation-Spitze = **Tisch-Session** |
| Accessory-Aktion | Öffnet denselben Bon-Sheet wie Dock (`showBon`) |
| Fallback &lt; iOS 26 | Bestehender Dock-Button in `TableSessionView` unverändert |
| Amber-Schwellwert | **45 Minuten** ab `openedAt` |
| Amber betrifft | Timer-Text + Karten-Rand (`statusAmber`) |
| Amber betrifft nicht | „Besetzt“-Badge (bleibt Occupied/Akzent) |

## Architektur

```
RootView.kellnerTabView (TabView)
  └─ #available(iOS 26): tabViewBottomAccessory
       └─ sichtbar nur wenn Preference/Environment „inTableSession“
            + cartQty Badge → showBon der aktiven Session

TableSessionView
  ├─ setzt Preference/Environment (inSession=true, cartQty, openBon)
  ├─ Dock Bon (alle iOS) — Fallback / immer verfügbar
  └─ BonSheetView (Phase 3)

PosDesign
  ├─ sessionAmberAfterMinutes = 45
  ├─ sessionAgeMinutes(openedAt:now:)
  └─ tableStatusColor(..., ageMinutes:) → statusAmber wenn ≥ 45
```

Session → TabView-Kommunikation: SwiftUI `PreferenceKey` (oder schlankes
EnvironmentObject nur für „active session chrome“). Kein neuer Sync-Layer.

## 4a — Tab Accessory „Bon öffnen“

### Verhalten

1. Nur Kellner-`TabView` (nicht Hub-SplitView).
2. Accessory gerendert nur unter iOS 26+.
3. Sichtbar nur während `TableSessionView` gemountet/oben im Stack ist.
4. Label/Icon analog Dock: Bon + optional Badge = Summe Cart-Mengen.
5. Tap → `showBon = true` (identischer Sheet, inkl. Senden/Fire/Zur Rechnung).
6. Wenn Session geschlossen (Back): Accessory aus.

### Nicht tun

- Accessory auf Reservierungen/Mehr anzeigen
- Zweiten parallelen Bon-State erfinden
- Liquid-Glass-Redesign der gesamten App

## 4b — Amber ab 45 Min

### Logik

```swift
static let sessionAmberAfterMinutes = 45

static func sessionAgeMinutes(openedAt: String, now: Date = Date()) -> Int? { … }

static func tableStatusColor(isOpen: Bool, openCents: Int, ageMinutes: Int? = nil) -> Color {
    guard isOpen else { return statusFree }
    if let age = ageMinutes, age >= sessionAmberAfterMinutes { return statusAmber }
    // bestehende Occupied-Logik
}
```

### UI

- `TablesHomeView` Tischkarte: Randfarbe über erweitertes `tableStatusColor`;
  Timer-`Text`/`Image` foreground Amber wenn Schwellwert erreicht.
- Session-Header in `TableSessionView`, falls Timer dort gezeigt wird: gleiche Regel.
- Bestehendes `tick`-Timer-Refresh (ca. 30s) reicht; kein neuer Poll nötig.

### Tests

- Unit: Alter 44 → nicht Amber; 45/120 → Amber.
- Unit: geschlossener Tisch ignoriert ageMinutes.
- Optional UITest-Smoke: unverändert Phase-3-Flow (kein Glass-Zwang auf Sim iOS 26.5 ok zum manuellen Check).

## Erfolgskriterien

1. Auf iOS 26 in einer Tisch-Session erscheint Tab-Accessory „Bon“; Tap öffnet Bon-Sheet.
2. Außerhalb der Session / auf iOS 17–18 kein Accessory; Dock bleibt.
3. Offene Tische ≥ 45 Min: Timer + Rand Amber; Badge „Besetzt“ unverändert.
4. Bestehende Phase-3-Unit/UITests bleiben grün.

## Datei-Anker

| Bereich | Dateien |
|---------|---------|
| TabView | `apps/pos/Sources/UI/RootView.swift` |
| Session / Dock | `apps/pos/Sources/UI/TableSessionView.swift` |
| Tischkarte | `apps/pos/Sources/UI/TablesHomeView.swift` |
| Tokens/Helper | `apps/pos/Sources/UI/PosDesign.swift` |
| Tests | `apps/pos/Tests/GwadaPOSTests/` (neu: Timer/Amber) |

## Abgrenzung

Phase 4 endet hier. Weitere Politur (Fonts, volles Liquid-Glass-Theme) nur nach
neuer Spec.
