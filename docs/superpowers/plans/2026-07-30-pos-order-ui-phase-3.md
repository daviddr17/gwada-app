# POS Order-UI Phase 3 (Bon + Küche) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Bon-sheet-from-dock review → send → fire-per-course, with cart signature/merge and full offline create-order payloads.

**Architecture:** Local cart stays in `TableSessionView`; `BonSheetView` is the only place to edit/send/fire. Signature/merge live on `PosCartLine`. Hub fire state becomes per session+course. Summary API exposes `firedAt` + `course` into `SessionOpenLine`. Sync queue carries the same item fields as live `PosCloudOrderItem`.

**Tech Stack:** Swift 5 / SwiftUI (`apps/pos`), XCTest, XcodeGen; Next summary DTO (`apps/web/lib/pos/pos-session-settlement-server.ts`); Nest `fireCourse` unchanged.

**Spec:** `docs/superpowers/specs/2026-07-30-pos-order-ui-phase-3-design.md`

## Global Constraints

- iOS deployment target **17.0**; system fonts only.
- Course UI **1..3**; backend `course >= 1`.
- **No DB migration** — only DTO/`firedAt` mapping if needed.
- No Liquid Glass / iOS 26 work (Phase 4).
- Kassieren remains existing `SplitPayView` via „Zur Rechnung“.
- Pairing / Hub enrollment flows untouched.
- Do not restore session-level „Bestellung senden“ or orange „Fire“ after 3c.

## File map

| File | Responsibility |
|------|----------------|
| `apps/pos/Sources/Cart/PosCartModels.swift` | `configurationSignature`, merge helpers |
| `apps/pos/Sources/Store/PosSyncQueue.swift` | Full `PosSyncOrderItem` + Nest/Next flush mapping |
| `apps/pos/Sources/App/PosRuntime.swift` | `sendCart` enqueue full payload; `fireCourse` marks course; `loadOpenLines` maps course/firedAt |
| `apps/pos/Sources/Store/PosHubState.swift` | `firedCoursesBySession` |
| `apps/pos/Sources/Store/SessionOpenLine.swift` | `course`, `firedAt` |
| `apps/pos/Sources/Cloud/PosCloudClient.swift` | Summary line decode `firedAt` |
| `apps/web/lib/pos/pos-session-settlement-server.ts` | Select + map `fired_at` → `firedAt` |
| `apps/pos/Sources/UI/BonSheetView.swift` | **Create** — paper bon UI |
| `apps/pos/Sources/UI/TableSessionView.swift` | Dock badge, remove send/fire, open lines only, sheets |
| `apps/pos/Sources/UI/LineConfigureSheet.swift` | Confirm path uses merge helper |
| Tests under `apps/pos/Tests/GwadaPOSTests/` + UITests |

## Success Criteria

1. Ungesendete Positionen nur im Bon editierbar; Dock-Badge = Cart-Mengen-Summe.
2. Identische Config merged; Notes/Sides/Options unterscheiden Zeilen.
3. Senden + Fire nur im Bon.
4. Fire markiert nur den gewählten Gang; Abort nach erstem Fire blockiert.
5. Offline-Requeue behält `course` + `modifiers`.
6. „Zur Rechnung“ öffnet `SplitPayView`.

---

### Task 3a: Cart configuration signature

**Files:**
- Modify: `apps/pos/Sources/Cart/PosCartModels.swift`
- Create: `apps/pos/Tests/GwadaPOSTests/PosCartSignatureTests.swift`

**Interfaces:**
- Produces: `PosCartLine.configurationSignature` (computed `String`)
- Produces: `PosCartLine.sideModifiers` helper optional; signature must include sorted `modifiers.map(\.id)` and trimmed notes

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import GwadaPOS

final class PosCartSignatureTests: XCTestCase {
    func testSignatureIgnoresModifierOrder() {
        let a = PosCartLine(
            menuItemId: "m1", name: "Schnitzel", unitPriceCents: 1200,
            quantity: 1, course: 2, notes: "",
            modifiers: [
                .option(choiceId: "o2", name: "Scharf", priceDeltaCents: 0),
                .option(choiceId: "o1", name: "Pommes", priceDeltaCents: 100),
            ]
        )
        let b = PosCartLine(
            menuItemId: "m1", name: "Schnitzel", unitPriceCents: 1200,
            quantity: 1, course: 2, notes: "",
            modifiers: [
                .option(choiceId: "o1", name: "Pommes", priceDeltaCents: 100),
                .option(choiceId: "o2", name: "Scharf", priceDeltaCents: 0),
            ]
        )
        XCTAssertEqual(a.configurationSignature, b.configurationSignature)
    }

    func testSignatureDiffersOnNotesCourseAndSides() {
        let base = PosCartLine(
            menuItemId: "m1", name: "Schnitzel", unitPriceCents: 1200,
            quantity: 1, course: 2, notes: "", modifiers: []
        )
        var withNote = base
        withNote.notes = "ohne Zwiebel"
        var otherCourse = base
        otherCourse.course = 1
        var withSide = base
        withSide.modifiers = [
            PosCartModifier(
                id: "side-s1", type: "side", label: "Beilage: Salat",
                ingredientId: nil, optionChoiceId: "s1", priceDeltaCents: 200
            )
        ]
        XCTAssertNotEqual(base.configurationSignature, withNote.configurationSignature)
        XCTAssertNotEqual(base.configurationSignature, otherCourse.configurationSignature)
        XCTAssertNotEqual(base.configurationSignature, withSide.configurationSignature)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/pos && xcodegen generate
xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:GwadaPOSTests/PosCartSignatureTests
```

Expected: FAIL (no `configurationSignature`).

- [ ] **Step 3: Implement signature on `PosCartLine`**

```swift
var configurationSignature: String {
    let modIds = modifiers.map(\.id).sorted().joined(separator: ",")
    let note = notes.trimmingCharacters(in: .whitespacesAndNewlines)
    return [menuItemId, "\(course)", modIds, note].joined(separator: "|")
}
```

Do **not** add a parallel `sideMenuItemIds` array — sides stay as `type == "side"` modifiers.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/pos/Sources/Cart/PosCartModels.swift \
  apps/pos/Tests/GwadaPOSTests/PosCartSignatureTests.swift
git commit -m "feat(pos): cart line configuration signature for merge"
```

---

### Task 3b: Merge identical cart lines

**Files:**
- Modify: `apps/pos/Sources/Cart/PosCartModels.swift` (add `PosCart.merge`)
- Modify: `apps/pos/Sources/UI/TableSessionView.swift` (`quickAdd`)
- Modify: `apps/pos/Sources/UI/LineConfigureSheet.swift` (confirm → use merge via callback already appending; change caller)
- Modify: `apps/pos/Tests/GwadaPOSTests/PosCartSignatureTests.swift` (merge cases)

**Interfaces:**
- Consumes: `configurationSignature`
- Produces:

```swift
enum PosCart {
    /// Returns new array with `line` merged by signature (qty added) or appended.
    static func merging(_ lines: [PosCartLine], adding line: PosCartLine) -> [PosCartLine]
    /// Moves/merges when course changes on an existing line id.
    static func changingCourse(_ lines: [PosCartLine], lineId: String, to course: Int) -> [PosCartLine]
}
```

- [ ] **Step 1: Failing merge tests**

```swift
func testMergeAddsQuantity() {
    let first = PosCartLine(
        menuItemId: "m1", name: "Cola", unitPriceCents: 300,
        quantity: 1, course: 2, notes: "", modifiers: []
    )
    let second = PosCartLine(
        menuItemId: "m1", name: "Cola", unitPriceCents: 300,
        quantity: 2, course: 2, notes: "", modifiers: []
    )
    let merged = PosCart.merging([first], adding: second)
    XCTAssertEqual(merged.count, 1)
    XCTAssertEqual(merged[0].quantity, 3)
}

func testCourseChangeMergesIntoMatchingTarget() {
    let a = PosCartLine(
        id: "a", menuItemId: "m1", name: "Cola", unitPriceCents: 300,
        quantity: 1, course: 2, notes: "", modifiers: []
    )
    let b = PosCartLine(
        id: "b", menuItemId: "m1", name: "Cola", unitPriceCents: 300,
        quantity: 1, course: 1, notes: "", modifiers: []
    )
    let out = PosCart.changingCourse([a, b], lineId: "a", to: 1)
    XCTAssertEqual(out.count, 1)
    XCTAssertEqual(out[0].quantity, 2)
    XCTAssertEqual(out[0].course, 1)
}
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `PosCart.merging` / `changingCourse`**

```swift
enum PosCart {
    static func merging(_ lines: [PosCartLine], adding line: PosCartLine) -> [PosCartLine] {
        var out = lines
        if let idx = out.firstIndex(where: { $0.configurationSignature == line.configurationSignature }) {
            out[idx].quantity += line.quantity
            return out
        }
        out.append(line)
        return out
    }

    static func changingCourse(_ lines: [PosCartLine], lineId: String, to course: Int) -> [PosCartLine] {
        guard let idx = lines.firstIndex(where: { $0.id == lineId }) else { return lines }
        var moved = lines[idx]
        moved.course = course
        var without = lines
        without.remove(at: idx)
        return merging(without, adding: moved)
    }
}
```

- [ ] **Step 4: Wire UI**

In `TableSessionView.quickAdd` and wherever configure confirms (`onConfirm`):

```swift
cart = PosCart.merging(cart, adding: line)
```

Replace the existing plain-item `firstIndex` merge in `quickAdd` with `PosCart.merging` so sides/notes/options share one path.

- [ ] **Step 5: Run unit tests — PASS**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(pos): merge cart lines by configuration signature"
```

---

### Task 3e: Offline create-order keeps course + modifiers

**Files:**
- Modify: `apps/pos/Sources/Store/PosSyncQueue.swift` (`PosSyncOrderItem`, Nest `itemsPayload`, Next `createOrder` map)
- Modify: `apps/pos/Sources/App/PosRuntime.swift` (`sendCart` catch)
- Create: `apps/pos/Tests/GwadaPOSTests/PosSyncOrderItemCodableTests.swift`

**Interfaces:**
- Produces:

```swift
struct PosSyncOrderItem: Codable, Sendable {
    var menuItemId: String
    var quantity: Int
    var notes: String?
    var course: Int?
    var ohneIngredientIds: [String]?
    var modifiers: [PosCloudModifierPayload]? // or dedicated Codable twin
}
```

- Nest flush must include `course`, `notes`, `modifiers`, `ohneIngredientIds` in each item dict.
- Next flush must pass them into `PosCloudOrderItem(...)`.

- [ ] **Step 1: Failing Codable + mapping test**

```swift
func testSyncOrderItemRoundTripKeepsCourseAndModifiers() throws {
    let item = PosSyncOrderItem(
        menuItemId: "m1", quantity: 2, notes: "extra",
        course: 1,
        ohneIngredientIds: ["ing-1"],
        modifiers: [
            PosCloudModifierPayload(
                type: "option", label: "Groß", ingredientId: nil,
                optionChoiceId: "c1", priceDeltaCents: 50
            )
        ]
    )
    let data = try JSONEncoder().encode(item)
    let decoded = try JSONDecoder().decode(PosSyncOrderItem.self, from: data)
    XCTAssertEqual(decoded.course, 1)
    XCTAssertEqual(decoded.modifiers?.count, 1)
    XCTAssertEqual(decoded.ohneIngredientIds, ["ing-1"])
}

func testLegacyPayloadWithoutCourseStillDecodes() throws {
    let data = Data(#"{"menuItemId":"m1","quantity":1}"#.utf8)
    let decoded = try JSONDecoder().decode(PosSyncOrderItem.self, from: data)
    XCTAssertEqual(decoded.menuItemId, "m1")
    XCTAssertNil(decoded.course)
}
```

If `PosCloudModifierPayload` is `Encodable` only, add `Codable` or a small `PosSyncModifier` struct used in both places.

- [ ] **Step 2: Run — FAIL until model extended**

- [ ] **Step 3: Extend model + flush maps**

In Nest branch (`processViaNest` `.createOrder`):

```swift
if let course = item.course { row["course"] = course }
if let notes = item.notes, !notes.isEmpty { row["notes"] = notes }
if let ohne = item.ohneIngredientIds, !ohne.isEmpty { row["ohneIngredientIds"] = ohne }
if let mods = item.modifiers, !mods.isEmpty {
    row["modifiers"] = mods.map { m -> [String: Any] in
        var d: [String: Any] = ["type": m.type, "label": m.label]
        if let v = m.ingredientId { d["ingredientId"] = v }
        if let v = m.optionChoiceId { d["optionChoiceId"] = v }
        if let v = m.priceDeltaCents { d["priceDeltaCents"] = v }
        return d
    }
}
```

In Next branch, map all fields into `PosCloudOrderItem`.

In `PosRuntime.sendCart` catch, build `PosSyncOrderItem` from each `PosCartLine` the same way as the live `PosCloudOrderItem` map (course, ohne, modifiers, notes).

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(pos): keep course and modifiers on offline create-order queue"
```

---

### Task 3d: Fire-per-course state + `firedAt` on open lines

**Files:**
- Modify: `apps/pos/Sources/Store/PosHubState.swift`
- Modify: `apps/pos/Sources/App/PosRuntime.swift` (`fireCourse`, `loadOpenLines`, `releaseTable` callers unchanged API)
- Modify: `apps/pos/Sources/Store/SessionOpenLine.swift`
- Modify: `apps/pos/Sources/Cloud/PosCloudClient.swift` (`PosCloudSessionSummaryLine`)
- Modify: `apps/web/lib/pos/pos-session-settlement-server.ts` (`SessionSummaryLine`, `loadSessionLines` select, `mapSummaryLine`)
- Create: `apps/pos/Tests/GwadaPOSTests/PosFireCourseStateTests.swift`
- Extend: `apps/pos/Tests/GwadaPOSTests/PosCourseTests.swift` (decode `firedAt`)

**Interfaces:**
- Produces:

```swift
// PosHubState
func markFired(sessionId: String, course: Int)
func hasFired(sessionId: String) -> Bool          // any course — abort gate
func hasFired(sessionId: String, course: Int) -> Bool
func clearFired(sessionId: String)                // on release if needed

// SessionOpenLine
var course: Int
var firedAt: Date?
var isFired: Bool { firedAt != nil }
```

- Summary DTO: `firedAt: string | null` (ISO from `fired_at`).

- [ ] **Step 1: Failing Hub-state tests**

```swift
func testFirePerCourseAbortGate() {
    let hub = PosHubState.shared // or testable instance if injectable; else exercise via mark/has API
    // Prefer extracting a small PosFiredCourseStore if shared singleton is hard to reset.
}
```

Prefer a small pure type to avoid singleton pollution:

```swift
struct PosFiredCourseStore: Equatable {
    private var bySession: [String: Set<Int>] = [:]
    mutating func mark(sessionId: String, course: Int) {
        bySession[sessionId, default: []].insert(course)
    }
    func hasAny(sessionId: String) -> Bool { !(bySession[sessionId]?.isEmpty ?? true) }
    func has(sessionId: String, course: Int) -> Bool {
        bySession[sessionId]?.contains(course) ?? false
    }
    mutating func clear(sessionId: String) { bySession[sessionId] = nil }
}
```

Wire `PosHubState` to use it; keep public method names used by UI.

- [ ] **Step 2: Implement store + Hub wrappers; update `fireCourse`:**

```swift
PosHubState.shared.markFired(sessionId: sessionId, course: course)
```

- [ ] **Step 3: Web summary — add `fired_at` to select and map**

`loadSessionLines` select append `, fired_at`.

```typescript
// SessionSummaryLine
firedAt: string | null;

// mapSummaryLine
firedAt: row.fired_at ?? null,
```

- [ ] **Step 4: Swift decode**

```swift
// PosCloudSessionSummaryLine
var firedAt: Date? // decode ISO8601 string ifPresent

// SessionOpenLine
var course: Int
var firedAt: Date?
```

Update `loadOpenLines` mapping. Update any `SessionOpenLine(...)` call sites (Split/Move) to include `course` / `firedAt`.

- [ ] **Step 5: Unit tests PASS** (signature + fire store + summary JSON with `"firedAt":"2026-07-30T10:00:00Z"`)

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(pos): per-course fire state and firedAt on session summary lines"
```

---

### Task 3c: Bon sheet + session chrome

**Files:**
- Create: `apps/pos/Sources/UI/BonSheetView.swift`
- Modify: `apps/pos/Sources/UI/TableSessionView.swift`
- Modify: `apps/pos/Sources/UI/PaperReceiptView.swift` (only if small helpers needed)
- Create/Modify: `apps/pos/Tests/GwadaPOSUITests/Phase3BonSheetSmokeUITests.swift`

**Interfaces:**
- Consumes: `PosCart.merging` / `changingCourse`, `runtime.sendCart`, `runtime.fireCourse`, `SessionOpenLine.course` / `firedAt`
- Produces: `BonSheetView` sheet API:

```swift
struct BonSheetView: View {
    let tableLabel: String
    @Binding var cart: [PosCartLine]
    let openLines: [SessionOpenLine]
    let coverCount: Int?
    var onSend: () async -> Bool
    var onFire: (Int) async -> Void
    var onWeiterBestellen: () -> Void
    var onZurRechnung: () -> Void
}
```

- [ ] **Step 1: Build `BonSheetView` UI**

Structure:

```swift
NavigationStack {
  ScrollView {
    PaperReceiptView {
      // header: tableLabel, covers, totals
      ForEach(PosCourse.uiCourses, id: \.self) { course in
        let cartLines = cart.filter { $0.course == course }
        let sent = openLines.filter { $0.course == course }
        if !cartLines.isEmpty || !sent.isEmpty {
          Text(PosCourse.label(course)).font(PosDesign.fontDisplay)
          ForEach(cartLines) { line in /* ±, ↻ course cycle, price */ }
          ForEach(sent) { line in /* read-only + fired badge */ }
          if sent.contains(where: { $0.firedAt == nil }) {
            Button("\(PosCourse.label(course)) schicken") { Task { await onFire(course) } }
          }
        }
      }
    }
  }
  .safeAreaInset(edge: .bottom) {
    VStack {
      Button("Senden · \(PosMoney.format(cartTotal))") { Task { _ = await onSend() } }
        .disabled(cart.isEmpty)
      HStack {
        Button("Weiter bestellen", action: onWeiterBestellen)
        Button("Zur Rechnung", action: onZurRechnung)
      }
    }
  }
}
.accessibilityIdentifier("pos.bon.sheet")
```

±: decrement to 0 removes line. ↻: `cart = PosCart.changingCourse(cart, lineId:id, to: nextCourse)` cycling 1→2→3→1.

- [ ] **Step 2: Rework `TableSessionView`**

- Keep `cart` state; menu writes via `PosCart.merging`.
- Upper list: **only** `openLines` (gesendet). Empty copy mentions Speisekarte + Bon.
- `bottomBar`:
  - Remove „Bestellung senden“ and orange Fire.
  - Keep Freigeben/Abbruch when session open.
  - Add primary Dock button „Bon“ with badge `cart.reduce(0){$0+$1.quantity}` (`accessibilityIdentifier("pos.bon.open")`).
- Sheets: `showBon`; on Zur Rechnung set `showBon=false` then `showSplit=true`.
- `onSend`: existing `sendCart()` logic (clear cart on success, refresh open lines).
- `onFire`: `runtime.fireCourse(sessionId:ensureSessionId(), course:)` then refresh open lines.

- [ ] **Step 3: UITest smoke**

```swift
// After tables → Tisch 1 → add is hard without menu a11y;
// Minimum: open session, open Bon sheet via pos.bon.open, assert pos.bon.sheet exists.
```

If menu item a11y ids are missing, add `accessibilityIdentifier("pos.menu.item.\(item.id)")` on menu cards only if needed for the smoke; otherwise manual send/fire.

- [ ] **Step 4: Build + UITest**

```bash
cd apps/pos && xcodegen generate
xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:GwadaPOSUITests/Phase3BonSheetSmokeUITests
```

Also run `GwadaPOSTests` for signature/sync/fire.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(pos): bon sheet dock flow with send and per-course fire"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| 3a Signature / sides via modifiers | 3a |
| 3b Merge + course-change merge | 3b |
| 3c Bon sheet, dock badge, chrome | 3c |
| 3d Fire-per-course + firedAt | 3d |
| 3e Offline full payload | 3e |
| Zur Rechnung → SplitPay | 3c |
| No session send/fire CTAs | 3c |
| No DB migration | 3d (DTO only) |

## Suggested task order

`3a → 3b → 3e → 3d → 3c` (model/sync before UI).

## Out of scope reminders

- Liquid Glass tab accessory, amber timer, custom fonts.
- Changing Nest `fireCourse` semantics.
- TSE/new receipt flow.
