# POS Layout-Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Kellner floor + order chrome in line with the prototype layout/flow, with adaptive Light/Dark theme (Light = default baseline).

**Architecture:** Expand `PosDesign` to adaptive semantic tokens; redesign `TablesHomeView` cards; restructure `TableSessionView` to menu-first + hide tab bar + single Bon dock; polish `BonSheetView` copy/chrome. No SplitPay/Kassieren changes.

**Tech Stack:** SwiftUI, XcodeGen, XCTest, iOS 17.0 deployment.

**Spec:** `docs/superpowers/specs/2026-07-30-pos-layout-parity-design.md`  
**Review:** `docs/superpowers/2026-07-30-prototyp-vs-app-review.md`

## Global Constraints

- Light + Dark adaptive; **Light is design baseline** (no forced dark-only).
- Deployment target stays **17.0**.
- System fonts only (no custom font files).
- No Kassieren/SplitPay logic changes.
- Keep Phase-3 Bon send/fire/zur Rechnung behavior.
- Amber ≥45 min rules from Phase 4 unchanged (timer + border, not badge).
- Simulator for tests: `F2795DCE-459A-4B85-A3B6-958BD1076685`.
- After `xcodegen generate`: `git checkout -- Config/Info.plist`.
- Branch: `cursor/pos-layout-parity-2026-07-30`.

## File map

| File | Responsibility |
|------|----------------|
| `PosDesign.swift` | Adaptive tokens + status dots + shared chrome helpers |
| `TablesHomeView.swift` | Floor cards (big number, dots, header) |
| `TableSessionView.swift` | Menu-first, hide tab bar, guests ±, single dock |
| `MenuBrowserView.swift` | Token backgrounds if needed |
| `BonSheetView.swift` | Prototyp-aligned labels (Gang N) |
| `PosCartModels.swift` | `PosCourse.chipLabel` → `"Gang \(n)"` for UI chips |
| `PosHubState.swift` / `PosRuntime.swift` | Optional `updateCoverCount` for guests ± |
| Tests | Token/status helpers; smoke still green |

Suggested order: **1 → 2 → 3 → 4** (Theme → Floor → Order → Bon).

---

### Task 1: Adaptive theme tokens

**Files:**
- Modify: `apps/pos/Sources/UI/PosDesign.swift`
- Create: `apps/pos/Tests/GwadaPOSTests/PosDesignThemeTests.swift`

- [ ] **Step 1: Failing test — Light/Dark pairs resolve**

```swift
import XCTest
@testable import GwadaPOS

final class PosDesignThemeTests: XCTestCase {
    func testStatusDotColorsDistinct() {
        let all = PosTableVisualStatus.allCases.map(PosDesign.statusDotColor(for:))
        // At least frei vs besetzt vs bezahlt must differ (compare UIColor in light)
        let light = UITraitCollection(userInterfaceStyle: .light)
        let resolved = all.map { UIColor($0).resolvedColor(with: light) }
        XCTAssertNotEqual(resolved[0], resolved[1])
    }
}
```

- [ ] **Step 2: Run — expect fail / compile fail until types exist**

```bash
cd apps/pos && xcodegen generate && git checkout -- Config/Info.plist
xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,id=F2795DCE-459A-4B85-A3B6-958BD1076685' \
  -only-testing:GwadaPOSTests/PosDesignThemeTests
```

- [ ] **Step 3: Implement adaptive tokens + `PosTableVisualStatus`**

In `PosDesign.swift`:

```swift
enum PosTableVisualStatus: String, CaseIterable {
    case frei, besetzt, bestellt, serviert, zahlt, bezahlt
}

// Adaptive Color via UIColor { traits in ... }
static let bg: Color = ...
static let surface: Color = ...
// ink, muted, brass, paper, green, line, surface2

static func statusDotColor(for status: PosTableVisualStatus) -> Color { ... }

static func visualStatus(isOpen: Bool, openCents: Int, paidSettled: Bool = false) -> PosTableVisualStatus {
    guard isOpen else { return .frei }
    if paidSettled { return .bezahlt }
    if openCents > 0 { return .bestellt } // heuristic until finer states exist
    return .besetzt
}
```

Light: warm cream bg/surface (refine existing). Dark: briefing `#101B16` / `#18261F` / ivory ink.  
Keep existing amber helpers and `tableStatusColor` APIs working (border may still use occupied/amber).

Wire root kellner content backgrounds to `PosDesign.bg` where screens still use `systemGroupedBackground`.

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Commit**

```bash
git add apps/pos/Sources/UI/PosDesign.swift apps/pos/Tests/GwadaPOSTests/PosDesignThemeTests.swift
git commit -m "feat(pos): adaptive light/dark PosDesign tokens and status dots"
```

---

### Task 2: Floor card redesign

**Files:**
- Modify: `apps/pos/Sources/UI/TablesHomeView.swift`

- [ ] **Step 1: Manual baseline screenshot optional** (`/tmp/pos-floor-before.png`)

- [ ] **Step 2: Redesign card**

Per open/free table:
- Status **dot** + short label (not only Besetzt pill as hero)
- **Large** table label (`PosDesign.fontDisplay` ~34–40pt)
- Timer (amber rule unchanged), `cover_count` Pers., open sum mono
- Free: dashed border, muted number, „Tippen zum Eröffnen“
- Background `PosDesign.surface` / transparent free; screen bg `PosDesign.bg`
- Header: restaurant name from `runtime.snapshot` if present + compact search/toolbar

Remove dominance of large yellow „Besetzt“ capsule as primary status signal (dot wins; optional small secondary text ok).

- [ ] **Step 3: Build**

```bash
xcodebuild build -project GwadaPOS.xcodeproj -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,id=F2795DCE-459A-4B85-A3B6-958BD1076685'
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(pos): prototype-like floor cards with status dots"
```

---

### Task 3: Order chrome (menu-first + dock + guests)

**Files:**
- Modify: `apps/pos/Sources/UI/TableSessionView.swift`
- Modify: `apps/pos/Sources/Cart/PosCartModels.swift` (chip label)
- Modify: `apps/pos/Sources/Store/PosHubState.swift` (+ `PosRuntime` if needed) for cover updates

- [ ] **Step 1: Course chip label**

```swift
// PosCourse
static func chipLabel(_ course: Int) -> String { "Gang \(course)" }
```

Use `chipLabel` in `TableSessionView` active-course chips; keep `label` for Bon/KDS if desired or switch Bon fire button to „Gang N schicken“.

- [ ] **Step 2: Menu-first layout**

- Collapse/remove large empty „Noch nichts gesendet“ as main hero; optional one-line hint if no sent lines.
- Course row: caption „Neue Artikel auf“ + Gang 1–3 chips.
- `MenuBrowserView` takes remaining flex space immediately.

- [ ] **Step 3: Hide tab bar in session**

```swift
.toolbar(.hidden, for: .tabBar)
```

on `TableSessionView` body (iOS 17+).

- [ ] **Step 4: Single primary dock**

- Primary: Brass/`PosPrimaryButtonStyle` — `Bon öffnen` + optional `· N neu` + trailing `fmt(cartTotal+…)` or cart total.
- Secondary (outline): Freigeben/Abbruch above primary, smaller — not equal visual weight.
- Keep `accessibilityIdentifier("pos.bon.open")`.
- iOS 26 accessory may remain (same opener).

- [ ] **Step 5: Guests ±**

- Header stepper bound to `currentSession?.cover_count`.
- Implement `PosHubState.updateCoverCount(sessionId:count:)` (local snapshot mutate).
- `PosRuntime.updateCovers(sessionId:covers:)` — local first; cloud PATCH only if endpoint already exists (otherwise document local-only + TODO, do not invent API).

- [ ] **Step 6: Build + unit tests (theme still pass)**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(pos): menu-first session chrome with Gang chips and Bon dock"
```

---

### Task 4: Bon sheet polish

**Files:**
- Modify: `apps/pos/Sources/UI/BonSheetView.swift`

- [ ] **Step 1: Align copy**

- Course headers: **GANG N** (mono/caps style via existing fonts).
- Fire: „Gang N schicken“.
- Keep Senden / Weiter bestellen / Zur Rechnung.
- Ensure paper on `PosDesign.bg` / paper tokens work in Light and Dark.

- [ ] **Step 2: Build**

- [ ] **Step 3: Smoke**

```bash
# Hub on iPad :8787, then:
xcodebuild test … -only-testing:GwadaPOSUITests/Phase3OrderFlowSmokeUITests
```

Expected: **TEST SUCCEEDED**.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(pos): align Bon sheet course chrome with prototype"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Adaptive Light/Dark tokens | 1 |
| Floor big number + status dots | 2 |
| Menu-first + Gang chips + hide tab bar + dock + guests | 3 |
| Bon chrome | 4 |
| No Kassieren | Global |
| Amber unchanged | Global / LP2 |

## Out of scope reminders

Custom fonts, SplitPay redesign, Reservierungen polish, Schichtübergabe, forced dark-only theme.
