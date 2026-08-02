# POS UI Review — Light Mode / Components (2026-08-02)

Scope before Hub-Offline-Plan (#1–#10). Decisions: Simulator iPad+iPhone, Light primary + Dark smoke, Gwada brand tokens (not restaurant accent), Bon without paper, dead code cleanup, commit.

## Done

### Design tokens (`PosDesign`)
- Aligned to Web/Superadmin `globals.css`: `--brand-accent` `#EAB308`, `--accent-foreground` `#171717`, light bg/card/border/muted.
- `resolveAccentHex` / `brandTint` always Gwada — restaurant `brandAccentHex` ignored in UI.
- Brand-action fills/borders for primary buttons (readable dark text on pale gold).

### Components
- `PosPrimaryButtonStyle` / `PosSecondaryButtonStyle` / chips / badges / segmented / menu cards use `PosDesign.*`.
- New reusable `PosPanelCard` for surfaces (Bon, lists).
- Onboarding: titles/links in `ink`/`muted` (no yellow body text on light).

### Bestell-Bon
- `BonSheetView` uses `PosPanelCard` — **no** `PaperReceiptView` / Sägezahn-Papier.
- `PaperReceiptView` remains for echte Belege (`PosGuestReceiptSheet`).

### Dead code removed
- `FormalInvoiceSheet`, `RegisterView`, `SplitPayView`, `PosCashKeypad`, `PosGiftVoucherScannerView`, `PosOrderLineIdMap`
- `PosRuntime.addDemoOrder`, unused `posLiquidGlassCard`
- Kept `PosCloudClient` Formal-Invoice API stubs for later wiring

### Tests
| Suite | Result |
|-------|--------|
| GwadaPOSTests (54) | pass |
| HandheldSoloSmoke | pass |
| Phase3BonSheetSmoke | pass |
| Phase3OrderFlowSmoke (Solo) | pass |
| Phase3OrderFlowSmoke (LAN-Pair) | pass **wenn** Hub `:8787` läuft; sonst **XCTSkip** (kein Fail) |
| HandheldPairToLocalHub | pass wenn Hub up; sonst XCTSkip |

Hub `:8787` healthy when iPad DEBUG-Hub läuft.

### Screenshots
Under this folder: `01`–`07` (iPad/iPhone light, dark regression, onboarding, after UI tests).

## Not started
Hub-Offline-Plan phases #1–#10 (`docs/plans/2026-08-02-pos-hub-offline-outbox.md`).
