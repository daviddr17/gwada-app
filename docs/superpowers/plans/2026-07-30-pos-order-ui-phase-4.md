# POS Order-UI Phase 4 (Politur) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship iOS-26 session-only Bon `tabViewBottomAccessory` and 45-minute amber timer/border polish without changing Phase-3 Bon/send/fire behavior.

**Architecture:** Pure helpers on `PosDesign` for session age + amber color; `TablesHomeView`/`TableSessionView` consume them. Session publishes chrome via a `PreferenceKey` so `RootView`’s Kellner `TabView` can show a Bon accessory only while a table session is on top (iOS 26+). Pre-26 keeps the existing dock button.

**Tech Stack:** Swift 5 / SwiftUI (`apps/pos`), XCTest, XcodeGen. Deployment target **iOS 17.0**.

**Spec:** `docs/superpowers/specs/2026-07-30-pos-order-ui-phase-4-design.md`

## Global Constraints

- iOS deployment target remains **17.0**; Glass/Accessory behind `#available(iOS 26, *)`.
- Bon accessory **only** when navigation tip is `TableSessionView`.
- Accessory opens the **same** `showBon` sheet as the dock.
- Amber at **45 minutes** from `openedAt`: timer text + card **border** only — **Besetzt badge stays Occupied/accent** (not amber).
- No custom fonts, no schema/API migrations, no send/fire/SplitPay logic changes.
- Pairing / Hub enrollment untouched.

## File map

| File | Responsibility |
|------|----------------|
| `apps/pos/Sources/UI/PosDesign.swift` | `sessionAmberAfterMinutes`, `sessionAgeMinutes`, extended `tableStatusColor` |
| `apps/pos/Sources/UI/TablesHomeView.swift` | Pass age into border tint; amber timer foreground |
| `apps/pos/Sources/UI/TableSessionView.swift` | Preference for session chrome; keep dock |
| `apps/pos/Sources/UI/PosSessionBonChrome.swift` (**create**) | PreferenceKey + small accessory button view |
| `apps/pos/Sources/UI/RootView.swift` | `tabViewBottomAccessory` on Kellner TabView |
| `apps/pos/Tests/GwadaPOSTests/PosSessionAmberTests.swift` (**create**) | Unit tests for age + color |

## Success Criteria

1. iOS 26 + in session → Tab accessory Bon; tap opens Bon sheet.
2. Outside session / iOS &lt; 26 → no accessory; dock remains.
3. Open tables ≥ 45 min → timer + border amber; badge not amber.
4. `GwadaPOSTests` green; Phase-3 smokes still compile/run.

---

### Task 4b: Session age + amber table chrome

**Files:**
- Modify: `apps/pos/Sources/UI/PosDesign.swift`
- Modify: `apps/pos/Sources/UI/TablesHomeView.swift`
- Create: `apps/pos/Tests/GwadaPOSTests/PosSessionAmberTests.swift`

**Interfaces:**
- Produces:

```swift
// PosDesign
static let sessionAmberAfterMinutes = 45
static func sessionAgeMinutes(openedAt: String, now: Date = Date()) -> Int?
static func tableStatusColor(isOpen: Bool, openCents: Int, ageMinutes: Int? = nil) -> Color
static func sessionTimerIsAmber(ageMinutes: Int?) -> Bool
```

- [ ] **Step 1: Write failing tests**

```swift
import XCTest
@testable import GwadaPOS

final class PosSessionAmberTests: XCTestCase {
    func testAgeMinutesFromOpenedAt() {
        let now = Date()
        let opened = ISO8601DateFormatter().string(from: now.addingTimeInterval(-44 * 60))
        XCTAssertEqual(PosDesign.sessionAgeMinutes(openedAt: opened, now: now), 44)
        let opened45 = ISO8601DateFormatter().string(from: now.addingTimeInterval(-45 * 60))
        XCTAssertEqual(PosDesign.sessionAgeMinutes(openedAt: opened45, now: now), 45)
    }

    func testTableStatusColorAmberOnlyWhenOpenAndOldEnough() {
        XCTAssertEqual(
            PosDesign.tableStatusColor(isOpen: true, openCents: 100, ageMinutes: 44),
            PosDesign.statusOccupied
        )
        XCTAssertEqual(
            PosDesign.tableStatusColor(isOpen: true, openCents: 100, ageMinutes: 45),
            PosDesign.statusAmber
        )
        XCTAssertEqual(
            PosDesign.tableStatusColor(isOpen: false, openCents: 0, ageMinutes: 120),
            PosDesign.statusFree
        )
    }

    func testTimerAmberFlag() {
        XCTAssertFalse(PosDesign.sessionTimerIsAmber(ageMinutes: 44))
        XCTAssertTrue(PosDesign.sessionTimerIsAmber(ageMinutes: 45))
        XCTAssertFalse(PosDesign.sessionTimerIsAmber(ageMinutes: nil))
    }
}
```

Note: `Color` equality can be flaky — if needed, compare via a small test-only helper that returns an enum (`free`/`occupied`/`occupiedSoft`/`amber`) instead of `Color`. Prefer an internal `PosTableChromeTone` enum used by both UI and tests if `Color` `==` fails.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/pos && xcodegen generate && git checkout -- Config/Info.plist
xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,id=F2795DCE-459A-4B85-A3B6-958BD1076685' \
  -only-testing:GwadaPOSTests/PosSessionAmberTests
```

- [ ] **Step 3: Implement helpers on `PosDesign`**

```swift
static let sessionAmberAfterMinutes = 45

static func sessionAgeMinutes(openedAt: String, now: Date = Date()) -> Int? {
    guard let opened = ISO8601DateFormatter().date(from: openedAt)
        ?? isoFractional.date(from: openedAt)
    else { return nil }
    return max(0, Int(now.timeIntervalSince(opened) / 60))
}

static func sessionTimerIsAmber(ageMinutes: Int?) -> Bool {
    guard let ageMinutes else { return false }
    return ageMinutes >= sessionAmberAfterMinutes
}

static func tableStatusColor(isOpen: Bool, openCents: Int, ageMinutes: Int? = nil) -> Color {
    guard isOpen else { return statusFree }
    if sessionTimerIsAmber(ageMinutes: ageMinutes) { return statusAmber }
    if openCents <= 0 { return statusOccupied.opacity(0.85) }
    return statusOccupied
}
```

Keep the existing 2-arg overload as a wrapper calling `ageMinutes: nil` **or** update all call sites — prefer adding default `nil` on the existing method.

- [ ] **Step 4: Wire `TablesHomeView.tableCard`**

```swift
let age = open.flatMap { PosDesign.sessionAgeMinutes(openedAt: $0.opened_at, now: tick) }
let borderTint = PosDesign.tableStatusColor(isOpen: isOpen, openCents: openCents, ageMinutes: age)
let badgeTint = PosDesign.tableStatusColor(isOpen: isOpen, openCents: openCents, ageMinutes: nil) // never amber
// border uses borderTint; PosStatusBadge uses badgeTint
// timer HStack:
.foregroundStyle(PosDesign.sessionTimerIsAmber(ageMinutes: age) ? PosDesign.statusAmber : Color.secondary)
```

- [ ] **Step 5: Tests PASS**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(pos): amber table timer and border after 45 minutes"
```

---

### Task 4a: Session PreferenceKey + iOS 26 Bon accessory

**Files:**
- Create: `apps/pos/Sources/UI/PosSessionBonChrome.swift`
- Modify: `apps/pos/Sources/UI/TableSessionView.swift`
- Modify: `apps/pos/Sources/UI/RootView.swift`

**Interfaces:**
- Produces:

```swift
struct PosSessionBonChrome: Equatable {
    var isActive: Bool
    var cartQuantity: Int
    var openBon: () -> Void  // NOT Equatable — store action via Preference carefully
}
```

Because closures break `Equatable` preferences, prefer **two** preferences:

```swift
struct PosSessionBonActiveKey: PreferenceKey {
    static var defaultValue = false
    static func reduce(value: inout Bool, nextValue: () -> Bool) { value = value || nextValue() }
}
struct PosSessionBonCartQtyKey: PreferenceKey {
    static var defaultValue = 0
    static func reduce(value: inout Int, nextValue: () -> Int) { value = max(value, nextValue()) }
}
```

And a shared `ObservableObject` or callback holder for open action:

```swift
@MainActor
final class PosSessionBonOpener: ObservableObject {
    var open: (() -> Void)?
    func trigger() { open?() }
}
```

Inject `PosSessionBonOpener` as `@StateObject` on `RootView` / kellner tab, pass via `.environmentObject`, set `opener.open = { showBon = true }` from `TableSessionView.onAppear` / `.onChange`, clear on `onDisappear`.

- [ ] **Step 1: Add `PosSessionBonChrome.swift` with opener + preference keys + accessory button**

```swift
struct PosBonTabAccessoryButton: View {
    let cartQuantity: Int
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Label {
                HStack(spacing: 6) {
                    Text("Bon")
                    if cartQuantity > 0 {
                        Text("\(cartQuantity)")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Capsule().fill(Color.accentColor))
                            .foregroundStyle(.white)
                    }
                }
            } icon: {
                Image(systemName: "doc.text")
            }
        }
        .accessibilityIdentifier("pos.bon.tabAccessory")
    }
}
```

- [ ] **Step 2: `TableSessionView` — publish prefs + register opener**

```swift
@EnvironmentObject private var bonOpener: PosSessionBonOpener
// in body chain:
.preference(key: PosSessionBonActiveKey.self, value: true)
.preference(key: PosSessionBonCartQtyKey.self, value: cart.reduce(0) { $0 + $1.quantity })
.onAppear { bonOpener.open = { showBon = true } }
.onDisappear { if bonOpener.open != nil { bonOpener.open = nil } }
```

Ensure `TablesHomeView` NavigationStack ancestors provide the environment object (from RootView).

Keep existing dock button + `accessibilityIdentifier("pos.bon.open")`.

- [ ] **Step 3: `RootView.kellnerTabView` — accessory**

```swift
@StateObject private var sessionBonOpener = PosSessionBonOpener()
@State private var sessionBonActive = false
@State private var sessionBonQty = 0

// wrap TabView:
TabView(…) { … }
  .environmentObject(sessionBonOpener)
  .onPreferenceChange(PosSessionBonActiveKey.self) { sessionBonActive = $0 }
  .onPreferenceChange(PosSessionBonCartQtyKey.self) { sessionBonQty = $0 }
  .modifier(PosBonTabAccessoryModifier(
      isActive: sessionBonActive,
      cartQuantity: sessionBonQty,
      opener: sessionBonOpener
  ))
```

```swift
struct PosBonTabAccessoryModifier: ViewModifier {
    let isActive: Bool
    let cartQuantity: Int
    @ObservedObject var opener: PosSessionBonOpener
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content.tabViewBottomAccessory {
                if isActive {
                    PosBonTabAccessoryButton(cartQuantity: cartQuantity) {
                        opener.trigger()
                    }
                }
            }
        } else {
            content
        }
    }
}
```

If `tabViewBottomAccessory` API requires different shape on the SDK in use, adjust to the compiler’s signature — do not raise deployment target.

Hub split view: **no** accessory modifier.

- [ ] **Step 4: Build**

```bash
cd apps/pos && xcodegen generate && git checkout -- Config/Info.plist
xcodebuild build -project GwadaPOS.xcodeproj -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,id=F2795DCE-459A-4B85-A3B6-958BD1076685'
```

Expected: **BUILD SUCCEEDED**.

- [ ] **Step 5: Run unit tests (incl. 4b)**

```bash
xcodebuild test … -only-testing:GwadaPOSTests
```

Expected: all pass.

- [ ] **Step 6: Manual / optional UI check on iOS 26.5 sim**

Open Tisch → confirm accessory (if API available) + dock; leave session → accessory gone.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(pos): iOS 26 session Bon tab accessory with dock fallback"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| 4b amber helpers + tests | 4b |
| 4b border + timer (not badge) | 4b |
| 4a Preference/opener + accessory | 4a |
| 4a session-only + dock fallback | 4a |
| Target 17.0 | Global |

## Suggested order

`4b → 4a` (helpers first; UI chrome second).

## Out of scope reminders

Custom fonts, raising deployment target, global accessory, Bon/send/fire changes.
