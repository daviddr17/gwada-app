# POS Positions-Storno (Line Void) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kellner können geschickte Open-Lines (Teil- oder Vollmenge) mit Pflicht-Grund stornieren; Hub ist SoT; Küchen-Storno nur wenn die Menge gefeuert war.

**Architecture:** `PosHubState.voidLocalOpenLine(...)` mutiert Open-Lines + optional KDS/Print; LAN `POST /v1/lines/void`; Handheld `PosRuntime.voidOpenLine` → Hub oder Solo; Sync-Queue Event `order.line_voided`; UI Sheet von Overview (Swipe + Long-press).

**Tech Stack:** SwiftUI POS (`apps/pos`), XCTest, bestehendes Hub-LAN / Sync-Queue / Void-Reasons-Cache

**Spec:** `docs/superpowers/specs/2026-08-05-pos-line-void-design.md`

## Global Constraints

- Teilmenge 1…`openQuantity`; auch nach Fire (Cap `void` nur dann Pflicht).
- Ungefeuert: jeder Kellner; gefeuert: Cap `void`.
- Küchen-Ticket/Print nur wenn `line.isFired`.
- Gründe: `pos_void_reasons` + optionale Notiz ≤80.
- Ansatz 2: Hub-LAN SoT, kein Cloud-only Void.
- Commits nur wenn der User explizit committen lässt (Repo-Regel).

---

## File map

| File | Role |
|------|------|
| `Sources/Store/PosLineVoid.swift` | Result-Enum, Cap-Helper, pure qty/cents math helpers if needed |
| `Sources/Store/PosHubState.swift` | `voidLocalOpenLine`, KDS/Print storno enqueue |
| `Sources/Store/PosSyncQueue.swift` | kind `lineVoided` + payload + flush stub/path |
| `Sources/LAN/PosLanProtocol.swift` | `voidLinePath = "/v1/lines/void"` |
| `Sources/LAN/HandheldHubClient.swift` | `voidLine(...)` |
| `Sources/App/PosRuntime.swift` | `voidOpenLine(...)` + Hub HTTP handler |
| `Sources/UI/LineVoidSheet.swift` | Qty + Gründe + Notiz |
| `Sources/UI/TableSessionOverviewView.swift` | Swipe + contextMenu → sheet |
| `Sources/UI/TableSessionView.swift` | Wire sheet + reload lines |
| `Tests/GwadaPOSTests/PosLineVoidTests.swift` | HubState void math + caps |

---

### Task 1: HubState void mutation + unit tests

**Files:**
- Create: `apps/pos/Sources/Store/PosLineVoid.swift`
- Modify: `apps/pos/Sources/Store/PosHubState.swift`
- Test: `apps/pos/Tests/GwadaPOSTests/PosLineVoidTests.swift`

**Interfaces:**
- Produces:
  ```swift
  enum PosLineVoidError: Error, Equatable {
      case lineNotFound
      case invalidQuantity
      case voidCapRequired
      case missingVoidReason
  }

  enum PosLineVoidResult: Equatable {
      case ok(remainingOpenQuantity: Int, kitchenStorno: Bool)
  }

  enum PosLineVoidPolicy {
      /// `true` if caller may void this line (fired ⇒ needs `hasVoidCap`).
      static func allowsVoid(lineFired: Bool, hasVoidCap: Bool) -> Bool
  }
  ```
- Produces on `PosHubState`:
  ```swift
  @discardableResult
  func voidLocalOpenLine(
      sessionId: String,
      lineId: String,
      quantity: Int,
      voidReasonId: String,
      note: String?,
      hasVoidCap: Bool,
      idempotencyKey: String
  ) -> Result<PosLineVoidResult, PosLineVoidError>
  ```

- [ ] **Step 1: Write failing tests** in `PosLineVoidTests.swift`

```swift
import XCTest
@testable import GwadaPOS

final class PosLineVoidTests: XCTestCase {
    func testPolicy_unfired_allowsWithoutCap() {
        XCTAssertTrue(PosLineVoidPolicy.allowsVoid(lineFired: false, hasVoidCap: false))
    }

    func testPolicy_fired_requiresCap() {
        XCTAssertFalse(PosLineVoidPolicy.allowsVoid(lineFired: true, hasVoidCap: false))
        XCTAssertTrue(PosLineVoidPolicy.allowsVoid(lineFired: true, hasVoidCap: true))
    }

    func testVoid_partialQuantity_updatesOpenCents() {
        let sid = "void-partial-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sid) }
        PosHubState.shared.replaceLocalOpenLines(sessionId: sid, lines: [
            SessionOpenLine(
                id: "L1", orderLineId: "L1", name: "Schnitzel",
                openQuantity: 3, openCents: 5550, course: 2, firedAt: nil,
                detail: "", menuItemId: "m1", lineQuantity: 3, lineTotalCents: 5550
            )
        ])
        let r = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 1,
            voidReasonId: "reason-1", note: nil, hasVoidCap: false,
            idempotencyKey: "k1"
        )
        guard case .ok(let rem, let kitchen) = r.get() else {
            return XCTFail("\(r)")
        }
        XCTAssertEqual(rem, 2)
        XCTAssertFalse(kitchen)
        let line = PosHubState.shared.localOpenLines(sessionId: sid)[0]
        XCTAssertEqual(line.openQuantity, 2)
        XCTAssertEqual(line.openCents, 3700) // 2/3 of 5550 via PosSettlementMath
    }

    func testVoid_fired_withoutCap_fails() {
        let sid = "void-fired-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sid) }
        var line = SessionOpenLine(
            id: "L1", orderLineId: "L1", name: "Cola",
            openQuantity: 1, openCents: 350, course: 1, firedAt: Date(),
            detail: "", lineQuantity: 1, lineTotalCents: 350
        )
        PosHubState.shared.replaceLocalOpenLines(sessionId: sid, lines: [line])
        let r = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 1,
            voidReasonId: "reason-1", note: nil, hasVoidCap: false,
            idempotencyKey: "k2"
        )
        XCTAssertEqual(r, .failure(.voidCapRequired))
    }

    func testVoid_fired_withCap_setsKitchenStorno() {
        let sid = "void-kitchen-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sid) }
        PosHubState.shared.replaceLocalOpenLines(sessionId: sid, lines: [
            SessionOpenLine(
                id: "L1", orderLineId: "L1", name: "Cola",
                openQuantity: 1, openCents: 350, course: 1, firedAt: Date(),
                detail: "", lineQuantity: 1, lineTotalCents: 350
            )
        ])
        let r = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 1,
            voidReasonId: "reason-1", note: "Gast", hasVoidCap: true,
            idempotencyKey: "k3"
        )
        guard case .ok(let rem, let kitchen) = r.get() else {
            return XCTFail("\(r)")
        }
        XCTAssertEqual(rem, 0)
        XCTAssertTrue(kitchen)
        XCTAssertTrue(PosHubState.shared.localOpenLines(sessionId: sid).isEmpty)
    }

    func testVoid_idempotent() {
        let sid = "void-idem-\(UUID().uuidString)"
        defer { PosHubState.shared.clearLocalOpenLines(sessionId: sid) }
        PosHubState.shared.replaceLocalOpenLines(sessionId: sid, lines: [
            SessionOpenLine(
                id: "L1", orderLineId: "L1", name: "Wasser",
                openQuantity: 2, openCents: 600, course: 1, firedAt: nil,
                detail: "", lineQuantity: 2, lineTotalCents: 600
            )
        ])
        let key = "same-key"
        _ = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 1,
            voidReasonId: "r", note: nil, hasVoidCap: false, idempotencyKey: key
        )
        let second = PosHubState.shared.voidLocalOpenLine(
            sessionId: sid, lineId: "L1", quantity: 1,
            voidReasonId: "r", note: nil, hasVoidCap: false, idempotencyKey: key
        )
        guard case .ok(let rem, _) = second.get() else { return XCTFail("\(second)") }
        XCTAssertEqual(rem, 1)
        XCTAssertEqual(PosHubState.shared.localOpenLines(sessionId: sid)[0].openQuantity, 1)
    }
}

private extension Result {
    func get() -> Success? {
        if case .success(let v) = self { return v }
        return nil
    }
}
```

Note: If `Result` equality for tests needs `PosLineVoidError: Equatable`, add it. Helper `get()` is test-only.

- [ ] **Step 2: Run tests — expect FAIL** (types missing)

```bash
cd apps/pos && xcodebuild test -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:GwadaPOSTests/PosLineVoidTests 2>&1 | tail -30
```

Expected: compile error or FAIL.

- [ ] **Step 3: Implement `PosLineVoid.swift` + `voidLocalOpenLine`**

`PosLineVoidPolicy.allowsVoid` as above.

`voidLocalOpenLine` logic (under HubState lock):
1. Track processed `idempotencyKey`s in a private `Set` or dict session→keys (persist optional; in-memory OK for Hub process lifetime; persist if easy via existing LocalStore — in-memory v1 OK).
2. If key already processed for this session/line: return `.ok` with current remaining qty and `kitchenStorno: false`.
3. Find line by `id` or `orderLineId`.
4. Guard `quantity` in 1…`openQuantity` else `.invalidQuantity`.
5. If `line.isFired` && !`hasVoidCap` → `.voidCapRequired`.
6. Guard `!voidReasonId.trimmingCharacters.isEmpty` else `.missingVoidReason`.
7. Reduce qty; `syncOpenCentsFromOriginal()`; remove line if `openQuantity == 0`.
8. `kitchenStorno = lineWasFired` (before mutation use saved `isFired`).
9. If `kitchenStorno`: enqueue KDS void ticket + print job labeled STORNO (reuse `enqueuePrintJobsLocked` pattern from fire; minimal ticket with negative/storno flag in line name prefix `"STORNO: "`).
10. Persist open lines; bump snapshot version if method available.
11. Return `.ok(remaining, kitchenStorno)`.

Do **not** enqueue SyncQueue inside HubState (Runtime/handler does that) — keep HubState pure mutation + kitchen side effects.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit** only if user asked

---

### Task 2: LAN protocol + Hub HTTP handler + Handheld client

**Files:**
- Modify: `apps/pos/Sources/LAN/PosLanProtocol.swift`
- Modify: `apps/pos/Sources/LAN/HandheldHubClient.swift`
- Modify: `apps/pos/Sources/App/PosRuntime.swift` (`handleHubRequest` branch)
- Test: extend `PosLineVoidTests` or `HubHTTPServerParseTests` if path parsing covered

**Interfaces:**
- Produces:
  ```swift
  // PosLanProtocol
  static let voidLinePath = "/v1/lines/void"

  // HandheldHubClient
  static func voidLine(
      baseURL: URL,
      pairToken: String?,
      sessionId: String,
      lineId: String,
      quantity: Int,
      voidReasonId: String,
      note: String?,
      waiterProfileId: String?,
      idempotencyKey: String
  ) async throws
  ```

- [ ] **Step 1: Add path constant**

```swift
static let voidLinePath = "/v1/lines/void"
```

- [ ] **Step 2: Implement `HandheldHubClient.voidLine`** mirroring `fireCourse` / `createOrder` POST JSON body.

- [ ] **Step 3: Hub handler** in `handleHubRequest` for `POST` + `voidLinePath`:
  - Decode body.
  - Resolve `hasVoidCap` from `waiterCaps[waiterProfileId]` contains `"void"` (if profile nil/empty → treat as no void cap).
  - Call `PosHubState.shared.voidLocalOpenLine(...)`.
  - On success: enqueue sync (Task 3) + `publishHubSnapshot()` / bump; return 200 JSON `{ok:true, openQuantity:n, kitchenStorno:bool}`.
  - Map errors to 400/403/404.

- [ ] **Step 4: Manual smoke** (Simulator Solo optional): unit test that protocol path string equals `/v1/lines/void`.

- [ ] **Step 5: Commit** only if user asked

---

### Task 3: Sync queue `lineVoided` + `PosRuntime.voidOpenLine`

**Files:**
- Modify: `apps/pos/Sources/Store/PosSyncQueue.swift`
- Modify: `apps/pos/Sources/App/PosRuntime.swift`
- Modify: `apps/pos/Sources/Store/PosHandheldOutbox.swift` only if handheld offline void must queue — **v1:** when hub disconnected, return error status „Kasse getrennt — Storno später“ OR enqueue outbox create-order-style event. Spec prefers Outbox; minimal: new outbox kind `lineVoid` flushing via Hub when reconnected **or** sync-only when Solo. Prefer: Runtime calls Hub when `hubBaseURL`; Solo calls HubState; hub-disconnected paired → Outbox event that on flush calls Hub `voidLine`.

**Interfaces:**
- Produces:
  ```swift
  // PosSyncQueueItemKind
  case lineVoided

  struct PosSyncLineVoidedPayload: Codable, Sendable {
      var restaurantId: String
      var tableSessionId: String
      var lineId: String
      var quantity: Int
      var voidReasonId: String
      var note: String?
      var wasFired: Bool
      var waiterProfileId: String?
      var idempotencyKey: String
  }

  // PosRuntime
  @discardableResult
  func voidOpenLine(
      sessionId: String,
      lineId: String,
      quantity: Int,
      voidReasonId: String,
      note: String?
  ) async -> Bool
  ```

- [ ] **Step 1: Add sync kind + encode + `enqueueLineVoided` + `process` branch**  
  Flush: Nest event type `"order.line_voided"` if Nest enabled; else Next stub that logs/no-ops without failing forever (or POST if route exists). Prefer Nest mirror of `fireCourse` process branch; if no Next route yet, Nest-only + local audit is enough for v1 (document in code comment).

- [ ] **Step 2: Implement `PosRuntime.voidOpenLine`**
  1. Resolve waiter profile id (PIN session / PosCloudConfig).
  2. `hasVoidCap` from `PosWaiterPinCache` / snapshot waiterCaps.
  3. `idempotencyKey = UUID().uuidString`.
  4. If hub connected (`hubBaseURL`, !solo): `HandheldHubClient.voidLine`.
  5. Else if solo / hub role: `PosHubState.voidLocalOpenLine` then `enqueueLineVoided` + audit + publishSnapshot.
  6. Else (paired, hub down): enqueue handheld outbox void **or** set statusMessage and return false — implement Outbox if pattern is clear in <1h, else statusMessage block for v1 and note follow-up.
  7. `PosAuditLog.record("order.line_voided", ...)`.
  8. Return success bool; update `statusMessage`.

- [ ] **Step 3: Unit test** Runtime not required; SyncQueue encode roundtrip test for payload.

- [ ] **Step 4: Commit** only if user asked

---

### Task 4: UI — `LineVoidSheet` + Overview gestures

**Files:**
- Create: `apps/pos/Sources/UI/LineVoidSheet.swift`
- Modify: `apps/pos/Sources/UI/TableSessionOverviewView.swift`
- Modify: `apps/pos/Sources/UI/TableSessionView.swift`
- Ensure `project.yml` / XcodeGen picks up new file (`xcodegen generate` if needed)

**Interfaces:**
- Overview gains:
  ```swift
  var onVoidLine: ((SessionOpenLine) -> Void)?
  var canVoidFired: Bool  // has void cap
  ```
- Sheet:
  ```swift
  struct LineVoidSheet: View {
      let line: SessionOpenLine
      let reasons: [PosCloudClient.PosVoidReasonDto]
      var onConfirm: (_ quantity: Int, _ reasonId: String, _ note: String) -> Void
      var onCancel: () -> Void
  }
  ```

- [ ] **Step 1: Build `LineVoidSheet`** — name, stepper 1…openQuantity (default max), reason list (required if non-empty), note TextField max 80, destructive confirm disabled until reason selected (or reasons empty → disable with message).

- [ ] **Step 2: Overview `lineRow`**
  - `.swipeActions(edge: .trailing) { Button("Stornieren", role: .destructive) { onVoidLine?(line) } }`
  - `.contextMenu { Button("Stornieren…", role: .destructive) { onVoidLine?(line) } }`
  - If `line.isFired && !canVoidFired`: show actions but sheet/runtime reject — or disable swipe with muted label „Storno (Recht fehlt)“; prefer allow open sheet that shows disabled confirm + footnote.

- [ ] **Step 3: `TableSessionView`**
  - `@State private var voidTarget: SessionOpenLine?`
  - `@State private var voidReasons: [...] = []`
  - Load reasons when sheet opens (cache via `PosOfflineCaches` / fetch).
  - `canVoidFired` from pin cache caps containing `"void"`.
  - On confirm: `await runtime.voidOpenLine(...)` then `reloadOpenLines()`.

- [ ] **Step 4: Manual check on Simulator** — Solo → order → fire → void with DEBUG cap if needed. Ensure Cap: temporarily treat DEBUG Solo as `hasVoidCap = true` when `PosSecurityPolicy.allowsSoloMode` **or** seed waiter cache with `void` in DEBUG — document choice in code (recommend: Solo DEBUG ⇒ `hasVoidCap = true` for lab).

- [ ] **Step 5: Commit** only if user asked

---

### Task 5: Wire Sync after Hub void + acceptance checklist

**Files:**
- Modify: Hub handler / `PosRuntime` paths from Tasks 2–3 so every successful void enqueues `PosSyncLineVoidedPayload` once (idempotencyKey = request key).

- [ ] **Step 1: Ensure single enqueue** on Hub success (handler) and Solo success (Runtime).

- [ ] **Step 2: Run full unit suite slice**

```bash
cd apps/pos && xcodebuild test -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:GwadaPOSTests/PosLineVoidTests 2>&1 | tail -40
```

Expected: all PASS.

- [ ] **Step 3: Spec acceptance checklist**
  - [ ] Unfired full void → no kitchen flag
  - [ ] Fired without cap → fail
  - [ ] Fired with cap partial → kitchen true, qty left
  - [ ] Swipe + long-press both open sheet
  - [ ] Reason required
  - [ ] Idempotent key

- [ ] **Step 4: Install on rippo2** when USB available (`ios-deploy --no-wifi`)

- [ ] **Step 5: Commit** only if user asked

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Teilmenge / voll | Task 1 |
| Cap unfired/fired | Task 1, 4 |
| Swipe + Long-press | Task 4 |
| Kitchen only if fired | Task 1 |
| Reasons + note | Task 4 |
| Hub LAN SoT | Task 2 |
| Sync event | Task 3 |
| Outbox / hub down | Task 3 (minimal or message) |
| Audit | Task 3 |
| Non-goals untouched | — |

## Placeholder scan

No TBD/TODO left as implementer instructions without code; Nest Next fallback documented as Nest-first with comment.
