# POS UI Audit — Glitches (2026-08-02)

Scope: Light Mode (primary), iPhone + iPad Simulator. Order/Kasse-Chrome vor Hub-Offline-Plan #1–#10.  
Basis: Gwada-Tokens (`PosDesign`), kein Restaurant-Accent, Bestell-Bon ohne Papier.

## Methode

1. Screenshots Kernscreens (Onboarding, Floor, Session/Bon-Smoke, iPad Launch).
2. Code-Scan: `Color.accentColor` / `.secondary` / System-Grouped-Fills / doppelte Titel / Sheet-Detents auf dem Order-Pfad.
3. P1/P2-Batch gefixt → Rebuild + Screenshots (dieses Verzeichnis).

## Findings → Fixes

| Prio | Screen | Glitch | Fix |
|------|--------|--------|-----|
| P1 | Kassieren | Gelber Betrag (`accent`) auf hellem Grund | `PosDesign.ink` |
| P1 | Payment | Sheet half-height → Session-Dock schimmert durch | Detent nur `.large` |
| P1 | Payment | Aktive Zahlart = System-Accent-Fill | `brandActionFill` / `brandActionBorder` |
| P1 | Kassieren | Doppel-CTA „Belege“ (Toolbar + Dock) | Dock-Button entfernt; Toolbar behält Belege |
| P1 | Bon | Detent `.medium` peekt Session-Dock | Nur `.large` |
| P1 | Session | Zweiter Bon-Button („antippen“) neben Dock | Status-Hinweis „unten öffnen“ (kein Button) |
| P1 | Floor (iPad) | Doppelter Titel „Tische“ (Nav + Header) | Header nur Belegungszeile |
| P1 | Receipts | „Antippen…“ in Accent-Gelb | `PosDesign.muted` |
| P2 | Onboarding | Code-Feld `secondarySystemGroupedBackground` | `surface2` + `line`-Border |
| P2 | Order-Pfad | Viele `.secondary` / System-Farben | `PosDesign.muted` / `ink` |
| P2 | Pairing-Gate | Gelbe Titel/Codes | Titel/Code `ink`, Hint `muted`, Icon Accent ok |
| P2 | Bon-Header | Monospace „BON“ wie Papierbeleg | Tisch + Gäste, linksbündig |

## Bewusst offen (nicht in diesem Batch)

| Thema | Warum |
|-------|--------|
| Reservierungen / KDS / Gutscheine / Audit | Nicht Order-kritisch; noch `.secondary` / Accent |
| Sidebar-Selektion gelb auf grau | System-`NavigationSplitView`-Tint — eigene Nav-Row später |
| Langer Timer amber („40 h …“) | Absicht (`statusAmber` ab Schwellwert) |
| Hub-Offline #1–#10 | Geplant nach Audit |

## Screenshots

- `01-iphone-onboarding.png` — vor Batch (Welcome)
- `02-iphone-after-bon-smoke.png` — Zwischenstand Install
- `03-ipad-launch.png` — Floor **vor** Fix (doppelter Titel „Tische“)
- `04-iphone-after-fix.png` — Welcome nach Fix (ink/muted, brand-action Weiter)
- `05-ipad-after-fix.png` — Floor nur Nav-Titel + Belegungszeile (kein Doppel-Titel)

## Verifikation

- Build: `GwadaPOS` Debug-Simulator **SUCCEEDED**
- Unit: `GwadaPOSTests` **54/54** pass
- Sims: iPhone 17 Pro + iPad Pro 13″, Light Mode

## Nächster Schritt

Hub-Offline-Plan **Phase 1** (Hub-Pflicht nach Onboarding; Solo nur DEBUG) — `docs/plans/2026-08-02-pos-hub-offline-outbox.md`.
