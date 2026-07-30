# Prototyp vs Swift-App — Layout- & Flow-Review

Stand: 2026-07-30. Kassieren-Spec **pausiert**. Fokus: Intensiv-Vergleich
`kellner-app-briefing.md` + `kellner-app-prototyp.jsx` ↔ native GwadaPOS (main nach PR #157).

## Methode

1. Briefing + Prototyp-Order/Floor/Bon gelesen.
2. Swift-UI (`TablesHomeView`, `TableSessionView`, `MenuBrowserView`, `BonSheetView`, `PosDesign`, `RootView`) gemappt.
3. Simulator-Smoke + Screenshots (iPhone `F2795DCE…`, Hub `:8787`):
   - Pairing-Gate
   - Tischplan
   - Tisch-Session
   - Bon-Sheet  
   Artefakte: `/tmp/pos-review-0{1,2,3,5}-*.png`  
   Phase-3-Flow war zuvor bereits **TEST SUCCEEDED**; hier zusätzlich visueller Capture.

## Gesamturteil

**Funktional** (Pair → Tisch → Menü/Bon → Senden/Fire → Rechnung) ist nah genug für Dev-Smoke.  
**Visuell und Flow-Chrome** sind **nicht** nah am Prototyp — eher iOS System-Light + gelber Accent als dunkles Flaschengrün/Messing-Service-UI. Dein Review („noch nicht nah genug“) bestätigt sich.

---

## Gap-Matrix (Layout & Flow)

| # | Prototyp (Soll) | App (Ist) | Schwere |
|---|-----------------|-----------|---------|
| G1 | Dunkles Theme `bg #101B16`, Surface `#18261F`, Ink Elfenbein, Brass CTA | Hell: `systemGroupedBackground`, Tokens in `PosDesign` sind **hell/warm** und kaum flächendeckend genutzt | **P0** |
| G2 | Fonts Bricolage / Instrument / Spline Mono | System Rounded / Body / monospacedDigit | P1 (Lizenz) |
| G3 | Tischplan: **große** Tischnummer, Status-**Punkt** (frei/besetzt/bestellt/serviert/zahlt/**bezahlt**), Timer, Gäste, Summe; Restaurant-Header + Station | Kleine Labels, Badge „Besetzt/Frei“, Search-first, kein Multi-Status-Punkt, kein „Station X“ | **P0** |
| G4 | Bestellaufnahme = **Menü-first** Vollfläche (Kategorie-Chips + 2-Spalten-Raster), Gang-Chips „Neue Artikel auf Gang 1–3“ | Session startet mit leerer „Noch nichts gesendet“-Fläche; Gang-Labels semantisch (Vorspeise/Hauptgang/Dessert); Menü oft unter dem Fold | **P0** |
| G5 | Daumen-Dock: ein Brass-Button **„Bon öffnen · N neu · Summe“**; Tab-Bar **ausgeblendet** | Tab-Bar bleibt sichtbar; **zwei** Bon-Einstiege (Dock-Primary + iOS-26 Accessory); Freigeben/Abbruch konkurriert oben im Dock | **P0** |
| G6 | Header: ← · Tisch · Timer/Status · ⇄ Umziehen · 🧾 Belege · Gäste **±** | Nav-Titel + Move/Split-Icons; **kein** Gäste-Stepper; Kapazität „4 Plätze“ ≠ aktive Gästezahl (Bon zeigte „2 Personen“) | **P0** |
| G7 | Papier-Bon mit GANG-Gruppen, ±, ↻, „Gang X schicken“, Summe, Weiter/Rechnung | Papier-Shell vorhanden; leerer Bon im Capture (0 €); Flow Send/Fire existiert, Optik/Copy weicht ab | P1 |
| G8 | Reservierungen: Tages-Timeline 17–23, Jetzt-Marker, Konflikt, Walk-in | `ReservationsView` hat Timeline — nicht im Screenshot-Lauf geprüft | P2 (noch testen) |
| G9 | Owner-Badge 👤 / Schichtübergabe ⇆ / PIN-Lock wie Prototyp | PIN existiert; Übergabe/Owner-Chrome am Tischplan fehlt bzw. anders | P2 |
| G10 | Status **bezahlt** (violett) → explizit freigeben | Freigeben-Button in Session, aber kein bezahlt-Status-Look wie Prototyp | P1 |

---

## Flow-Abweichungen (was sich „anders anfühlt“)

1. **Einstieg Tisch:** Prototyp öffnet sofort Bestellraster. App öffnet eine Session-Zwischenfläche mit Empty-State und Course-Chips für die *Anzeige*, nicht klar als „aktive Gang für neue Artikel“.
2. **Bon ist der Warenkorb:** Im Prototyp ist der ungesendete Cart nur im Bon; die Order-View ist Menü. In der App ist das ähnlich modelliert — aber die UI kommuniziert es schlecht (leere Mitte, doppelter Bon-Button).
3. **Einhand-Dock:** Prototyp ein primärer CTA. App stapelt Freigeben + Bon + Tab-Bar (+ optional Accessory) → Daumen-Konkurrenz.
4. **Visuelle Signatur:** Ohne Dunkel+Brass+große Display-Zahlen wirkt der Tischplan wie ein generisches Admin-Grid, nicht wie der Service-Floor.

---

## Was bereits passt

- 3 Tabs: Tische · Reservierungen · Mehr  
- 2-Spalten-Artikelraster vorhanden (`MenuBrowserView`)  
- One-Tap vs Configure-Sheet, Gang 1–3 im Datenmodell, Bon-Sheet, Fire, Zur Rechnung  
- Amber-Timer ≥ 45 min (Border/Timer)  
- iOS-26 Bon-Accessory (zusätzlich zum Dock)  
- Papier-Bon-Shell (`PaperReceiptView` / Bon)

---

## Empfohlene nächste Arbeit (ohne Kassieren)

**Phase „Layout-Parity“ (neue Spec, vor Kassieren):**

1. **Theme-Switch:** `PosDesign` auf Briefing-Tokens (Dunkel) flächendeckend anwenden — nicht nur Token definieren.  
2. **Tischplan-Redesign:** große Nummern, Status-Punkte (6er-Set), Header Restaurant+Station, Legende.  
3. **Order-Chrome:** Tab-Bar hide; Menü-first; Gang-Chips „Neue Artikel auf“; ein Brass-Dock „Bon öffnen · N · €“; Gäste ±.  
4. **Bon-Polish:** Copy/Layout an Prototyp-CartSheet (GANG-Zeilen, Buttons).  
5. Erst danach Kassieren/Split an Prototyp (Person-Dock, Gleich-teilen).

---

## Test-Notizen

- Hub DEBUG lokal + `debug-approve-all` nötig für iPhone-Pair.  
- Demo-Menü im Capture: kein Artikel mit „€“ → Bon blieb leer (0 €) — Menü-Smoke separat mit befülltem Catalog wiederholen.  
- Ephemeral Screenshot-UITest wurde nicht committed.

## Referenzen

- `/Users/fadihanna/Downloads/files-4/kellner-app-briefing.md`  
- `/Users/fadihanna/Downloads/files-4/kellner-app-prototyp.jsx`  
- Screenshots: `/tmp/pos-review-02-tables.png`, `03-session.png`, `05-bon.png`
