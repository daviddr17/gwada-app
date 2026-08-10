# POS Tisch mergen (Session Merge) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kellner können von einer offenen Session aus eine zweite belegte Session vollständig absorbieren: alle Open-Lines + Covers (Summe) auf dem Ziel-Tisch, Quelltisch frei.

**Architecture:** Hub-LAN SoT — `PosHubState.mergeLocalSessions` mutiert Floor/Lines/Fire/Locks; LAN `POST /v1/sessions/merge`; Handheld/Solo über `PosRuntime.mergeSessions`; Sync-Event `table.merged` → Nest `SessionsService.mergeSessions` (Orders umhängen, Covers, Quelle schließen).

**Tech Stack:** SwiftUI POS (`apps/pos`), XCTest, Hub-LAN / Sync-Queue, Nest `apps/pos-api`

**Spec:** `docs/superpowers/specs/2026-08-10-pos-table-merge-design.md`

## Global Constraints

- Semantik: Quell-Session **vollständig absorbieren** in gewähltes Ziel; Quelle freigeben.
- Einstieg nur Session-Menü (Mehr → Tisch mergen); Ziel = Überlebender.
- Merge **verboten**, wenn Quelle oder Ziel `kassierenLock` hat.
- `cover_count` Ziel = `max(1, source.cover_count + target.cover_count)`.
- Gefeuerte Lines 1:1 mitnehmen (`firedAt` / Course bleiben); Fire-Sets union.
- Draft-Cart der Quelle: **verwerfen** (nur Open-Lines zählen).
- Line-IDs: **reuse**, außer Kollision mit Ziel → neue UUID für `id` (Inhalt sonst gleich).
- Ansatz Hub-LAN SoT; Production Staff-Proof wie Void/Seat/Collect.
- Sync-Event-Name: **`table.merged`** (kind `sessionMerged`).
- Commits nur wenn der User explizit committen lässt (Repo-Regel).

---

## File map

| File | Role |
|------|------|
| `apps/pos/Sources/Store/PosSessionMerge.swift` | Errors, result, policy helpers |
| `apps/pos/Sources/Store/PosHubState.swift` | `mergeLocalSessions`, FiredCourseStore merge |
| `apps/pos/Sources/LAN/PosLanProtocol.swift` | `mergeSessionsPath` |
| `apps/pos/Sources/LAN/HandheldHubClient.swift` | `mergeSessions(...)` |
| `apps/pos/Sources/Store/PosSyncQueue.swift` | kind + payload + flush `table.merged` |
| `apps/pos/Sources/App/PosRuntime.swift` | `mergeSessions(...)` + Hub HTTP handler |
| `apps/pos/Sources/UI/MergeSessionSheet.swift` | Ziel-Picker belegte Tische |
| `apps/pos/Sources/UI/TableSessionView.swift` | Menü „Tisch mergen“ |
| `apps/pos-api/src/sessions/sessions.service.ts` | `mergeSessions(...)` |
| `apps/pos-api/src/sessions/sessions.controller.ts` | optional REST; Sync nutzt Service |
| `apps/pos-api/src/sync/sync.service.ts` | case `table.merged` |
| `apps/pos/Tests/GwadaPOSTests/PosSessionMergeTests.swift` | Hub + policy tests |

---

### Task 1: Policy types + HubState merge mutation + unit tests

**Files:**
- Create: `apps/pos/Sources/Store/PosSessionMerge.swift`
- Modify: `apps/pos/Sources/Store/PosHubState.swift` (`PosFiredCourseStore` + `mergeLocalSessions`)
- Test: `apps/pos/Tests/GwadaPOSTests/PosSessionMergeTests.swift`

**Interfaces:**
- Produces:
```swift
enum PosSessionMergeError: Error, Equatable {
    case sameSession
    case sourceNotFound
    case targetNotFound
    case kassierenActive
    case missingIdempotencyKey
}

enum PosSessionMergeResult: Equatable {
    case ok(targetSessionId: String, coverCount: Int, idempotentReplay: Bool)
}

enum PosSessionMergePolicy {
    /// Beide Sessions dürfen keinen Kassieren-Lock haben.
    static func canMerge(sourceLocked: Bool, targetLocked: Bool) -> Bool {
        !sourceLocked && !targetLocked
    }
}
```
- Produces on `PosHubState`:
```swift
func mergeLocalSessions(
    sourceSessionId: String,
    targetSessionId: String,
    idempotencyKey: String
) -> Result<PosSessionMergeResult, PosSessionMergeError>
```
- Extends `PosFiredCourseStore`:
```swift
mutating func absorb(from otherSessionId: String, into targetSessionId: String) {
    let courses = bySession[otherSessionId] ?? []
    if !courses.isEmpty {
        bySession[targetSessionId, default: []].formUnion(courses)
    }
    bySession[otherSessionId] = nil
}
```

- [ ] **Step 1: Write failing tests**

```swift
import XCTest
@testable import GwadaPOS

final class PosSessionMergeTests: XCTestCase {
    func testPolicy_blocksAnyKassierenLock() {
        XCTAssertTrue(PosSessionMergePolicy.canMerge(sourceLocked: false, targetLocked: false))
        XCTAssertFalse(PosSessionMergePolicy.canMerge(sourceLocked: true, targetLocked: false))
        XCTAssertFalse(PosSessionMergePolicy.canMerge(sourceLocked: false, targetLocked: true))
    }

    func testMerge_absorbsLinesAndSumsCovers_freesSourceTable() {
        let hub = PosHubState.shared
        hub.resetForFactoryReset()
        hub.configure(hubDeviceId: "merge-test-hub")
        hub.loadCachedOrDemo()
        let tables = hub.makeSnapshot().floor.tables.filter(\.is_active)
        XCTAssertGreaterThanOrEqual(tables.count, 2)
        let t1 = tables[0].id
        let t2 = tables[1].id
        // Use the same openLocalSession / appendOpenLine helpers as PosLocalOpenLinesTests
        // (copy exact signatures from that file — do not invent alternate APIs).
        let s1 = /* open session on t1 cover 2 */
        let s2 = /* open session on t2 cover 3 */
        // Attach ≥1 open line to s1
        let key = "idem-merge-1"
        let result = hub.mergeLocalSessions(sourceSessionId: s1, targetSessionId: s2, idempotencyKey: key)
        guard case .ok(let target, let covers, let replay) = result else {
            return XCTFail("expected ok \(result)")
        }
        XCTAssertEqual(target, s2)
        XCTAssertEqual(covers, 5)
        XCTAssertFalse(replay)
        let floor = hub.makeSnapshot().floor
        XCTAssertNil(floor.openSessions.first(where: { $0.id == s1 }))
        XCTAssertEqual(floor.openSessions.first(where: { $0.id == s2 })?.cover_count, 5)
        XCTAssertFalse(floor.openSessions.contains(where: { $0.dining_table_id == t1 }))
    }

    func testMerge_kassierenLock_rejects() {
        // open two sessions, setKassierenLock on source, expect .failure(.kassierenActive)
    }

    func testMerge_idempotentReplay() {
        // same key twice → second ok with idempotentReplay == true, line count unchanged
    }
}
```

- [ ] **Step 2: Run tests — expect FAIL** (types / method missing)

```bash
cd apps/pos && xcodegen generate && xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:GwadaPOSTests/PosSessionMergeTests \
  -derivedDataPath /tmp/gwada-pos-dd
```

Expected: compile error or FAIL (missing `mergeLocalSessions`).

- [ ] **Step 3: Implement `PosSessionMerge.swift` + Hub mutation**

`PosSessionMerge.swift`: errors/result/policy as above.

`PosHubState.mergeLocalSessions` (under `lock`):

1. Guard non-empty `idempotencyKey` else `.missingIdempotencyKey`.
2. Idempotency map (private `[String: PosSessionMergeResult]` on Hub, cleared on factory reset): if key known → return stored `.ok(..., idempotentReplay: true)`.
3. `sourceSessionId != targetSessionId` else `.sameSession`.
4. Resolve both sessions in `bootstrap.floor.openSessions` else not found.
5. If `kassierenLocksBySession[source]` or `[target]` non-nil → `.kassierenActive`.
6. Move lines: `var moved = localOpenLinesBySession[source] ?? []`; for each line, if target already has same `id` then `line.id = UUID().uuidString`; append to target; remove source key; persist open lines.
7. Update target session `cover_count = max(1, src.cover_count + tgt.cover_count)`.
8. Recompute target meta `openCents` / orderCount from lines (same helpers used after createOrder).
9. `firedCourses.absorb(from: source, into: target)`.
10. Remove source session from floor; clear source lock/draft (`PosDraftCartStore.clear`); do **not** clear target.
11. Persist bootstrap, bump snapshot, store idempotency result, return `.ok`.

- [ ] **Step 4: Run tests — expect PASS**

Same `xcodebuild` command as Step 2.

- [ ] **Step 5: Commit** (nur nach User-OK)

```bash
git add apps/pos/Sources/Store/PosSessionMerge.swift \
  apps/pos/Sources/Store/PosHubState.swift \
  apps/pos/Tests/GwadaPOSTests/PosSessionMergeTests.swift
git commit -m "feat(pos): Hub mergeLocalSessions absorbs source into target"
```

---

### Task 2: LAN protocol + Handheld client + Hub HTTP handler

**Files:**
- Modify: `apps/pos/Sources/LAN/PosLanProtocol.swift`
- Modify: `apps/pos/Sources/LAN/HandheldHubClient.swift`
- Modify: `apps/pos/Sources/App/PosRuntime.swift` (Hub `handleHubRequest` POST branch)

**Interfaces:**
- Produces path: `static let mergeSessionsPath = "/v1/sessions/merge"`
- Produces client:
```swift
func mergeSessions(
    sourceSessionId: String,
    targetSessionId: String,
    idempotencyKey: String,
    staffId: String?,
    staffSessionId: String?
) async throws -> (targetSessionId: String, coverCount: Int)
```

- [ ] **Step 1: Add path constant**

```swift
static let mergeSessionsPath = "/v1/sessions/merge"
```

- [ ] **Step 2: Implement `HandheldHubClient.mergeSessions`**

Mirror `seatReservation` / void: POST JSON body with `sourceSessionId`, `targetSessionId`, `idempotencyKey`; send Staff headers; decode `{ ok, targetSessionId, coverCount }`; map non-2xx to thrown errors with server `code` if present.

- [ ] **Step 3: Hub HTTP handler**

In `PosRuntime.handleHubRequest`, after seat/void-style blocks:

```swift
if pathOnly == PosLanProtocol.mergeSessionsPath {
    // decode body; Staff-Proof like void (same pattern as seat)
    // call PosHubState.shared.mergeLocalSessions(...)
    // on success enqueue sync (Task 3 fills enqueue if not ready — call Runtime helper)
    // return 200 JSON or 4xx with code
}
```

Error mapping:

| Hub error | HTTP | `code` |
|-----------|------|--------|
| sameSession | 400 | `same_session` |
| sourceNotFound / targetNotFound | 404 | `source_not_found` / `target_not_found` |
| kassierenActive | 409 | `kassieren_active` |
| missingIdempotencyKey | 400 | `missing_idempotency_key` |
| staff missing (prod) | 403 | `staff_proof_required` |

- [ ] **Step 4: Smoke** — build POS target compiles with new path/client.

- [ ] **Step 5: Commit** (nach User-OK)

```bash
git commit -m "feat(pos): LAN POST /v1/sessions/merge + Handheld client"
```

---

### Task 3: PosRuntime.mergeSessions + Sync-Queue `table.merged`

**Files:**
- Modify: `apps/pos/Sources/App/PosRuntime.swift`
- Modify: `apps/pos/Sources/Store/PosSyncQueue.swift`

**Interfaces:**
- Produces:
```swift
@discardableResult
func mergeSessions(
    sourceSessionId: String,
    targetSessionId: String,
    idempotencyKey: String = UUID().uuidString
) async -> Result<PosSessionMergeResult, PosSessionMergeError>
```
- Sync:
```swift
case sessionMerged

struct PosSyncSessionMergedPayload: Codable, Sendable {
    var restaurantId: String
    var sourceSessionId: String
    var targetSessionId: String
    var sourceDiningTableId: String
    var targetDiningTableId: String
    var coverCount: Int
    var idempotencyKey: String
}

func enqueueSessionMerged(_ payload: PosSyncSessionMergedPayload)
```

Flush maps to Nest event `type: "table.merged"` with payload fields; envelope `sessionId` = `targetSessionId`.

- [ ] **Step 1: Add Sync kind + payload + enqueue + flush branch**

Copy structure from `moveSession` / `reservationSeated` cases in `PosSyncQueue.swift`. Include `sessionMerged` in the same flush-eligible sets as `moveSession`.

- [ ] **Step 2: Implement `PosRuntime.mergeSessions`**

Pattern like `moveSession` / `seatReservation`:

1. Handheld + live Hub → `HandheldHubClient.mergeSessions`; refresh snapshot; return mapped result.
2. Solo / Hub device → `PosHubState.mergeLocalSessions`; on `.ok` enqueue `PosSyncSessionMergedPayload` (capture table IDs from floor before/during mutation); `publishSnapshot`; flush if possible.
3. Handheld without Hub → statusMessage „Mergen nur mit erreichbarer Kasse.“ + failure (**no** Nest-only bypass for merge in v1).

- [ ] **Step 3: Wire Hub HTTP success path to enqueue** (if not done in Task 2)

- [ ] **Step 4: Run `PosSessionMergeTests` again — still PASS**

- [ ] **Step 5: Commit** (nach User-OK)

```bash
git commit -m "feat(pos): mergeSessions runtime + sync table.merged"
```

---

### Task 4: Nest `mergeSessions` + Sync handler

**Files:**
- Modify: `apps/pos-api/src/sessions/sessions.service.ts`
- Modify: `apps/pos-api/src/sessions/sessions.controller.ts` (optional POST for parity)
- Modify: `apps/pos-api/src/sync/sync.service.ts`

**Interfaces:**
```typescript
async mergeSessions(params: {
  restaurantId: string;
  sourceSessionId: string;
  targetSessionId: string;
  coverCount?: number;
}): Promise<
  | { ok: true; coverCount: number }
  | { ok: false; error: string; status: number }
>
```

- [ ] **Step 1: Implement `SessionsService.mergeSessions`**

Logic:

1. Load source + target; both must exist, same restaurant, status in `ACTIVE_SESSION_STATUSES`.
2. Reject if `sourceSessionId === targetSessionId` → `same_session` 400.
3. `UPDATE pos_orders SET table_session_id = target WHERE table_session_id = source AND restaurant_id = …`.
4. Set target `cover_count` to `params.coverCount ?? source.cover_count + target.cover_count` (min 1).
5. Close source using the **same status/`closed_at` fields as `release`** in this service (copy that update shape — do not invent a new status string).
6. Idempotent: if source already not active and no orders remain on source → `{ ok: true }`.

- [ ] **Step 2: Sync case**

```typescript
case "table.merged": {
  const r = await this.sessions.mergeSessions({
    restaurantId: ctx.restaurantId,
    sourceSessionId: String(p.sourceSessionId ?? ""),
    targetSessionId: String(p.targetSessionId ?? ev.sessionId ?? ""),
    coverCount: p.coverCount == null ? undefined : Number(p.coverCount),
  });
  return r.ok ? { ok: true, result: r } : { ok: false, error: r.error };
}
```

- [ ] **Step 3: Optional controller POST** `/sessions/merge` — same body; Sync-only is enough for POS.

- [ ] **Step 4: Typecheck** `apps/pos-api` if project script exists (`pnpm --filter pos-api` / `tsc`); fix types.

- [ ] **Step 5: Commit** (nach User-OK)

```bash
git commit -m "feat(pos-api): mergeSessions + sync table.merged"
```

---

### Task 5: UI `MergeSessionSheet` + Session menu

**Files:**
- Create: `apps/pos/Sources/UI/MergeSessionSheet.swift`
- Modify: `apps/pos/Sources/UI/TableSessionView.swift`

**Interfaces:**
- Sheet inputs: `sourceSessionId: String`, `sourceTableId: String`
- Candidates: other **occupied** tables (session ≠ source). Hub enforces Kassieren-Lock; show `runtime.statusMessage` on failure.

- [ ] **Step 1: Build `MergeSessionSheet`** (mirror `MoveSessionSheet`)

```swift
struct MergeSessionSheet: View {
    @EnvironmentObject private var runtime: PosRuntime
    @Environment(\.dismiss) private var dismiss
    let sourceSessionId: String
    let sourceTableId: String
    @State private var targetSessionId: String?
    @State private var busy = false
    @State private var errorText = ""

    private var candidates: [(table: PosLanFloorTable, session: PosLanOpenSession)] {
        guard let floor = runtime.snapshot?.floor else { return [] }
        return floor.openSessions.compactMap { session in
            guard session.id != sourceSessionId,
                  let table = floor.tables.first(where: { $0.id == session.dining_table_id && $0.is_active })
            else { return nil }
            return (table, session)
        }
    }
    // Form: footnote, list with checkmark, Confirm „Mergen“
    // on confirm: await runtime.mergeSessions(...)
}
```

Accessibility: `pos.session.mergeSheet`, confirm `pos.session.mergeConfirm`.

- [ ] **Step 2: Wire `TableSessionView`**

Add `@State private var showMergeSession = false`.

In the existing Umziehen-`Menu`, add:

```swift
Button("Tisch mergen") {
    showMergeSession = true
}
.disabled(resolvedSessionId.isEmpty || resolvedSessionId.hasPrefix("pending-"))
.accessibilityIdentifier("pos.session.mergeMenu")
```

```swift
.sheet(isPresented: $showMergeSession) {
    MergeSessionSheet(sourceSessionId: resolvedSessionId, sourceTableId: table.id)
        .environmentObject(runtime)
}
```

On success while viewing source: dismiss to floor (user opens Ziel). Prefer navigate to target if easy with existing navigation; floor is acceptable for v1.

- [ ] **Step 3: Optional UITest smoke** — skip if setup is heavy; then rely on Task 6 manual checklist.

- [ ] **Step 4: Commit** (nach User-OK)

```bash
git commit -m "feat(pos): MergeSessionSheet + session menu entry"
```

---

### Task 6: Acceptance checklist + polish

**Files:** none required unless bugs found.

- [ ] **Step 1: Manual / Simulator acceptance**

1. Solo Demo, 2 Tische: beide öffnen, Positionen auf Quelle schicken.
2. Quelle → Menü → Tisch mergen → Ziel wählen → Mergen.
3. Quelle frei; Ziel hat alle Lines; Covers Summe.
4. Kassieren auf Ziel starten → Merge von anderer Session → Fehler `kassieren_active`.
5. (Optional) Hub+Handheld: Merge am Phone, Floor auf iPad aktualisiert.

- [ ] **Step 2: Fix any bugs found; re-run `PosSessionMergeTests`**

- [ ] **Step 3: Commit** (nach User-OK)

```bash
git commit -m "fix(pos): table merge acceptance polish"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Full absorb | 1 |
| User picks target; start = source | 5 |
| No Kassieren lock | 1, 5 |
| Cover sum | 1, 4 |
| Session menu only | 5 |
| Fired lines 1:1 | 1 (`firedAt` + absorb courses) |
| Hub-LAN SoT | 2, 3 |
| Sync `table.merged` + Cloud | 3, 4 |
| Draft source discard | 1 |
| Idempotency | 1 |
| Staff-Proof | 2 |
| No Floor entry / Undo / Teil-Merge | — out of scope |

## Placeholder scan

No TBD left; Cloud close-status must **match existing `release`** (Task 4).

## Type consistency

- Errors: `PosSessionMergeError` / `PosSessionMergeResult` in Hub, Runtime, tests.
- Sync kind: `sessionMerged` → event `table.merged`.
- Path: `/v1/sessions/merge`.
