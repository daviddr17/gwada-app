# POS Tisch-Überblick (Session Hub) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Running tables with open bon lines open on an overview first; menu only after Bestellen; contextual Kassieren/Freigeben primary CTA.

**Architecture:** Phase enum inside `TableSessionView` (`overview` | `ordering`). Pure helpers compute start phase, open/paid cents, and course chips. New `TableSessionOverviewView` renders stats + open lines + dock; ordering keeps today’s menu UI.

**Tech Stack:** Swift 5 / SwiftUI (`apps/pos`), XCTest, XcodeGen. Deployment target **iOS 17.0**.

**Spec:** `docs/superpowers/specs/2026-08-03-pos-table-overview-design.md`

## Global Constraints

- Overview **only** when `openLines` is non-empty at entry (decision A).
- Dock: open € > 0 → **Kassieren** primary + **Bestellen** secondary; open € = 0 → **Tisch freigeben** primary + **Bestellen** secondary (decision B).
- Hybrid list: open lines only; paid as **sum** (decision C).
- Navigation = phases in `TableSessionView` (Ansatz 1) — no new NavigationLink stack for overview.
- No new Cloud API; no Floor redesign; no „Überblick+“ features (repeat last order, paid history list).
- Reuse `PosButton`, `PosThumbDock`, `PosCardRow`, `PosMoney`, existing sheets.
- Commits only when the user explicitly asks (repo rule) — skip Step „Commit“ until then.

## File map

| File | Responsibility |
|------|----------------|
| `apps/pos/Sources/Store/PosSessionOverviewMath.swift` (**create**) | Start phase, open/paid cents, course status labels |
| `apps/pos/Sources/UI/TableSessionOverviewView.swift` (**create**) | Overview UI + dock callbacks |
| `apps/pos/Sources/UI/TableSessionView.swift` (**modify**) | Phase state, branch body, toolbar Übersicht, wire dock |
| `apps/pos/Tests/GwadaPOSTests/PosSessionOverviewMathTests.swift` (**create**) | Unit tests for math / phase |
| `apps/pos/Tests/GwadaPOSUITests/TableOverviewUITests.swift` (**create**) | Smoke: overview appears when open lines exist (DEBUG Solo if available) |

## Success Criteria

1. Table with `openLines` → overview, not menu.
2. Empty bon → menu as today.
3. Bestellen → menu; Übersicht → overview (when lines remain).
4. Open € > 0 → Kassieren is primary dock button.
5. Open lines listed; „Bereits kassiert“ shows computed Y when > 0.
6. `PosSessionOverviewMathTests` green; app builds for simulator.

---

### Task 1: Overview math helpers + unit tests

**Files:**
- Create: `apps/pos/Sources/Store/PosSessionOverviewMath.swift`
- Create: `apps/pos/Tests/GwadaPOSTests/PosSessionOverviewMathTests.swift`

**Interfaces:**
- Produces:

```swift
enum PosSessionPhase: String, Equatable, Sendable {
    case overview
    case ordering
}

enum PosSessionOverviewMath {
    /// Entry phase: non-empty openLines → overview, else ordering.
    static func startPhase(openLines: [SessionOpenLine]) -> PosSessionPhase

    static func openCents(openLines: [SessionOpenLine]) -> Int

    /// Partial on still-open lines + optional full payments from local receipts (ex tip).
    static func paidCents(
        openLines: [SessionOpenLine],
        receipts: [PosLocalReceipt]
    ) -> Int

    /// Courses that appear in openLines, with short status for chips.
    static func courseStatuses(
        openLines: [SessionOpenLine],
        sessionId: String
    ) -> [(course: Int, label: String)]
}
```

- [ ] **Step 1: Write failing tests**

```swift
import XCTest
@testable import GwadaPOS

final class PosSessionOverviewMathTests: XCTestCase {
    func test_startPhase_emptyIsOrdering() {
        XCTAssertEqual(PosSessionOverviewMath.startPhase(openLines: []), .ordering)
    }

    func test_startPhase_withOpenLinesIsOverview() {
        let line = SessionOpenLine(
            id: "a", orderLineId: "a", name: "Cola",
            openQuantity: 1, openCents: 390, course: 2,
            firedAt: nil, detail: "", menuItemId: nil,
            lineQuantity: 1, lineTotalCents: 390
        )
        XCTAssertEqual(PosSessionOverviewMath.startPhase(openLines: [line]), .overview)
    }

    func test_paidCents_partialOnOpenLine() {
        let line = SessionOpenLine(
            id: "a", orderLineId: "a", name: "Pasta",
            openQuantity: 1, openCents: 1000, course: 2,
            firedAt: nil, detail: "", menuItemId: nil,
            lineQuantity: 2, lineTotalCents: 2000
        )
        XCTAssertEqual(
            PosSessionOverviewMath.paidCents(openLines: [line], receipts: []),
            1000
        )
    }

    func test_paidCents_includesReceiptAmountExTip() {
        let receipt = PosLocalReceipt(
            localId: "r1", paymentId: nil, orderId: nil, orderNumber: 1,
            tableSessionId: "s", tableLabel: "Tisch 1", diningTableId: "t",
            method: "cash", status: "paid", amountCents: 500, tipCents: 100,
            receivedAmountCents: nil, paidAt: "", fiscalPending: false,
            canVoidCash: false, dayYmd: "2026-08-03", label: nil,
            items: nil, waiterName: nil, tse: nil
        )
        XCTAssertEqual(
            PosSessionOverviewMath.paidCents(openLines: [], receipts: [receipt]),
            500
        )
    }
}
```

- [ ] **Step 2: Run tests — expect fail (type missing)**

```bash
cd apps/pos && xcodebuild test -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -only-testing:GwadaPOSTests/PosSessionOverviewMathTests 2>&1 | tail -40
```

Expected: compile error / test fail — `PosSessionOverviewMath` missing.

- [ ] **Step 3: Implement helpers**

```swift
import Foundation

enum PosSessionPhase: String, Equatable, Sendable {
    case overview
    case ordering
}

enum PosSessionOverviewMath {
    static func startPhase(openLines: [SessionOpenLine]) -> PosSessionPhase {
        openLines.isEmpty ? .ordering : .overview
    }

    static func openCents(openLines: [SessionOpenLine]) -> Int {
        openLines.reduce(0) { $0 + $1.openCents }
    }

    static func paidCents(
        openLines: [SessionOpenLine],
        receipts: [PosLocalReceipt]
    ) -> Int {
        let partial = openLines.reduce(0) { sum, line in
            sum + max(0, line.settlementLineTotalCents - line.openCents)
        }
        let fromReceipts = receipts.reduce(0) { $0 + max(0, $1.amountCents) }
        // Prefer max so partial-on-open + same payment in receipts is not double-counted
        // when receipts already include those slices. Spec v1: sum both only if
        // receipts are the source for fully paid lines no longer in openLines.
        // Implementation: partial + receipt amounts (receipts are completed collects;
        // open-line partial is also reflected when line still open — DO NOT double).
        // Rule: use receipts when non-empty for session/table; else partial only.
        if !receipts.isEmpty {
            return fromReceipts
        }
        return partial
    }

    static func courseStatuses(
        openLines: [SessionOpenLine],
        sessionId: String
    ) -> [(course: Int, label: String)] {
        let courses = Array(Set(openLines.map(\.course))).sorted()
        return courses.map { course in
            let needsFire = courseNeedsFire(
                openLines: openLines,
                course: course,
                sessionId: sessionId
            )
            let title = PosCourse.chipLabel(course)
            let suffix = needsFire ? "offen" : "geschickt"
            return (course, "\(title) · \(suffix)")
        }
    }
}
```

**Important paidCents rule (lock this in code comments):**  
If `receipts` for the table/session is non-empty → `Σ amountCents` (ex tip).  
Else → Σ (`settlementLineTotalCents − openCents`) on open lines.  
Never add both (avoids double-count on partial pays that already created receipts).

- [ ] **Step 4: Re-run tests — expect PASS**

Same `xcodebuild test` command as Step 2. Expected: **TEST SUCCEEDED**, 4 tests.

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add apps/pos/Sources/Store/PosSessionOverviewMath.swift \
  apps/pos/Tests/GwadaPOSTests/PosSessionOverviewMathTests.swift
git commit -m "$(cat <<'EOF'
feat(pos): session overview math for phase and paid cents

EOF
)"
```

---

### Task 2: `TableSessionOverviewView` UI

**Files:**
- Create: `apps/pos/Sources/UI/TableSessionOverviewView.swift`

**Interfaces:**
- Consumes: `PosSessionOverviewMath`, `SessionOpenLine`, `PosMoney`, `PosButton`, `PosThumbDock`, `PosCardRow`, `PosDesign`, `PosLayout`
- Produces: View with callbacks

```swift
struct TableSessionOverviewView: View {
    let openLines: [SessionOpenLine]
    let sessionId: String
    let tableLabel: String
    let paidCents: Int
    var onOrder: () -> Void
    var onCollect: () -> Void
    var onRelease: () -> Void
    var onOpenBon: () -> Void
    var canCollect: Bool
    var canRelease: Bool
}
```

- [ ] **Step 1: Build overview layout**

```swift
import SwiftUI

struct TableSessionOverviewView: View {
    let openLines: [SessionOpenLine]
    let sessionId: String
    let tableLabel: String
    let paidCents: Int
    var onOrder: () -> Void
    var onCollect: () -> Void
    var onRelease: () -> Void
    var onOpenBon: () -> Void
    var canCollect: Bool
    var canRelease: Bool

    private var openCents: Int { PosSessionOverviewMath.openCents(openLines: openLines) }
    private var courses: [(course: Int, label: String)] {
        PosSessionOverviewMath.courseStatuses(openLines: openLines, sessionId: sessionId)
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: PosLayout.stack) {
                    statsRow
                    courseRow
                    ForEach(openLines) { line in
                        Button(action: onOpenBon) {
                            lineRow(line)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, PosLayout.page)
                .padding(.top, 12)
                .padding(.bottom, 24)
            }
            dock
        }
        .accessibilityIdentifier("pos.session.overview")
    }

    private var statsRow: some View {
        HStack(spacing: 12) {
            statChip(title: "Offen", value: PosMoney.format(openCents))
            if paidCents > 0 {
                statChip(title: "Bereits kassiert", value: PosMoney.format(paidCents))
            }
            Spacer(minLength: 0)
        }
    }

    private func statChip(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(PosDesign.muted)
            Text(value)
                .font(.headline.monospacedDigit())
                .foregroundStyle(PosDesign.ink)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(PosDesign.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(PosDesign.line, lineWidth: 1)
        }
    }

    private var courseRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(courses, id: \.course) { item in
                    Text(item.label)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(PosDesign.surface2, in: Capsule())
                        .overlay { Capsule().strokeBorder(PosDesign.line, lineWidth: 1) }
                }
            }
        }
    }

    private func lineRow(_ line: SessionOpenLine) -> some View {
        PosCardRow {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text("\(line.openQuantity)×")
                    .font(.caption.monospacedDigit().weight(.semibold))
                    .foregroundStyle(PosDesign.muted)
                VStack(alignment: .leading, spacing: 2) {
                    Text(line.name)
                        .font(.body.weight(.medium))
                    if !line.detail.isEmpty {
                        Text(line.detail)
                            .font(.caption)
                            .foregroundStyle(PosDesign.muted)
                            .lineLimit(2)
                    }
                }
                Spacer(minLength: 4)
                Text(PosMoney.format(line.openCents))
                    .font(.body.monospacedDigit())
            }
        }
    }

    private var dock: some View {
        PosThumbDock {
            if openCents > 0 {
                HStack(spacing: 10) {
                    PosButton(title: "Bestellen", kind: .secondary, action: onOrder)
                        .accessibilityIdentifier("pos.session.overview.order")
                    PosButton(
                        title: "Kassieren · \(PosMoney.format(openCents))",
                        kind: .primary,
                        enabled: canCollect,
                        action: onCollect
                    )
                    .accessibilityIdentifier("pos.session.overview.collect")
                }
            } else {
                HStack(spacing: 10) {
                    PosButton(title: "Bestellen", kind: .secondary, action: onOrder)
                        .accessibilityIdentifier("pos.session.overview.order")
                    PosButton(
                        title: "\(tableLabel) freigeben",
                        kind: .primary,
                        enabled: canRelease,
                        action: onRelease
                    )
                    .accessibilityIdentifier("pos.session.overview.release")
                }
            }
        }
    }
}
```

Adjust `PosButton` initializer to match existing signature in `PosControls.swift` (kind / enabled / action). If `PosButton` does not take `enabled`, wrap `.disabled(!canCollect)`.

- [ ] **Step 2: Compile check**

```bash
cd apps/pos && xcodebuild -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -derivedDataPath /tmp/gwada-pos-overview build 2>&1 | tail -20
```

Expected: **BUILD SUCCEEDED** (or only unused-warning until Task 3 wires it).

- [ ] **Step 3: Commit** (only if user asked)

---

### Task 3: Wire phases into `TableSessionView`

**Files:**
- Modify: `apps/pos/Sources/UI/TableSessionView.swift`

**Interfaces:**
- Consumes: `PosSessionPhase`, `PosSessionOverviewMath`, `TableSessionOverviewView`, `PosOfflineCaches.receipts(forTableLabel:)`

- [ ] **Step 1: Add phase state + paid helper**

Near other `@State`:

```swift
@State private var phase: PosSessionPhase = .ordering
@State private var didApplyStartPhase = false
```

```swift
private var overviewPaidCents: Int {
    PosSessionOverviewMath.paidCents(
        openLines: openLines,
        receipts: PosOfflineCaches.receipts(forTableLabel: table.label)
            .filter { $0.tableSessionId == resolvedSessionId || resolvedSessionId.isEmpty }
    )
}
```

If session id filter drops all receipts in Solo, fall back to all receipts for `table.label` (label match only).

- [ ] **Step 2: Apply start phase after first `refreshOpenLines`**

In `.task` / after refresh:

```swift
.task {
    await refreshOpenLines()
    syncGuestCountFromSession()
    if !didApplyStartPhase {
        phase = PosSessionOverviewMath.startPhase(openLines: openLines)
        didApplyStartPhase = true
    }
}
```

Do **not** reset phase on every refresh (would kick user out of ordering mid-order).

- [ ] **Step 3: Branch `body` content**

Keep `header` always. Then:

```swift
if phase == .overview, !openLines.isEmpty {
    TableSessionOverviewView(
        openLines: openLines,
        sessionId: resolvedSessionId,
        tableLabel: table.label,
        paidCents: overviewPaidCents,
        onOrder: { phase = .ordering },
        onCollect: { showKassieren = true },
        onRelease: {
            Task {
                _ = await runtime.releaseTable(sessionId: resolvedSessionId, forceAbort: false)
            }
        },
        onOpenBon: { showBon = true },
        canCollect: runtime.canCollectAtRegister,
        canRelease: runtime.canMutateLiveFloor
    )
} else {
    // existing: Divider, courseRow, sentLinesHint, MenuBrowserView
}
```

- [ ] **Step 4: Dock + toolbar**

- `safeAreaInset` / `bottomBar`: only when `phase == .ordering` (overview has its own dock).
- Toolbar leading or trailing when `phase == .ordering && !openLines.isEmpty`:

```swift
Button("Übersicht") { phase = .overview }
    .accessibilityIdentifier("pos.session.overview.back")
```

- After Kassieren dismiss with `openLines` empty and session still open: keep `phase = .overview` (body shows release dock).
- If `openLines` becomes empty **and** session released / navigated away: no change needed.

- [ ] **Step 5: Build + unit tests**

```bash
cd apps/pos && xcodebuild test -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -only-testing:GwadaPOSTests/PosSessionOverviewMathTests 2>&1 | tail -30
```

Expected: **TEST SUCCEEDED**. Manual: Solo → Tisch mit Demo-Positionen → Überblick → Bestellen → Übersicht.

- [ ] **Step 6: Commit** (only if user asked)

---

### Task 4: UITest smoke (optional but preferred)

**Files:**
- Create: `apps/pos/Tests/GwadaPOSUITests/TableOverviewUITests.swift`

- [ ] **Step 1: Add UITest** that, in DEBUG Solo path used by other tests, opens a table with open lines and asserts `pos.session.overview` exists; taps `pos.session.overview.order` and asserts menu / absence of overview id OR presence of course chip.

Mirror launch setup from `ReservationsDateStripUITests` / `BarCashTipSmokeUITests` (Solo flag, reset, etc.).

- [ ] **Step 2: Run UITest**

```bash
cd apps/pos && xcodebuild test -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,name=iPhone 17,OS=26.5' \
  -only-testing:GwadaPOSUITests/TableOverviewUITests 2>&1 | tail -40
```

Expected: **TEST SUCCEEDED** (or skip with clear comment if Solo cannot seed open lines without extra setup — then document manual smoke only).

- [ ] **Step 3: Commit** (only if user asked)

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Entry only when openLines non-empty | Task 1 + 3 |
| Stats Offen + Bereits kassiert | Task 1 paidCents + Task 2 |
| Open lines list | Task 2 |
| Course short status | Task 1 courseStatuses + Task 2 |
| Dock B (Kassieren / Freigeben primary) | Task 2 |
| Ordering + Übersicht back | Task 3 |
| No double-count paid | Task 1 rule |
| Out of scope left out | — |

## Placeholder scan

None intentional. `PosButton` signature must be matched to `PosControls.swift` at implement time.
