# POS Reservierung platzieren (Seat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kellner können eine `confirmed`-Reservierung von Timeline oder Tischplan auf einen freien Tisch platzieren: POS-Session öffnen, Status `seated`, Navigation in die Bestellung.

**Architecture:** Hub-LAN SoT — `PosHubState.seatReservation(...)` öffnet Session + markiert Resa lokal `seated`; LAN `POST /v1/reservations/seat`; Handheld/Solo über `PosRuntime.seatReservation`; Sync-Event `reservation.seated` → Cloud Session mit `reservationId` + Status-Update.

**Tech Stack:** SwiftUI POS (`apps/pos`), XCTest, Hub-LAN / Sync-Queue, Next `apps/web` POS APIs

**Spec:** `docs/superpowers/specs/2026-08-06-pos-reservation-seat-design.md`

## Global Constraints

- Nur Status-Code `confirmed` seatbar.
- Tischwahl: zugewiesener freier Tisch → direkt; sonst Picker; belegt → `table_occupied`.
- Covers = `partySize` (min 1), in v1 nicht editierbar im Place-Flow.
- Einstieg: Timeline **und** Tischplan-Hinweis.
- Ansatz 2: Hub-LAN SoT; Production Staff-Proof wie Collect/Void.
- Sync-Event-Name: **`reservation.seated`** (kind `reservationSeated`).
- Commits nur wenn der User explizit committen lässt (Repo-Regel).

---

## File map

| File | Role |
|------|------|
| `Sources/Store/PosReservationSeat.swift` | Policy, errors, result, idempotency helpers |
| `Sources/Store/PosHubState.swift` | `seatLocalReservation(...)` |
| `Sources/Store/PosReservationsStore.swift` | Mark reservation seated + table in day cache |
| `Sources/Store/PosSyncQueue.swift` | kind + payload + flush |
| `Sources/LAN/PosLanProtocol.swift` | `seatReservationPath` |
| `Sources/LAN/HandheldHubClient.swift` | `seatReservation(...)` |
| `Sources/Cloud/PosCloudClient.swift` | `openTableSession` + `reservationId`; `seatReservation` API |
| `Sources/App/PosRuntime.swift` | `seatReservation(...)` + Hub HTTP handler |
| `Sources/UI/ReservationSeatSheet.swift` | Tisch-Picker / Confirm |
| `Sources/UI/ReservationsView.swift` | „Platzieren“ CTA |
| `Sources/UI/TablesHomeView.swift` | Hint tippbar → Seat-Flow |
| `apps/web/lib/pos/pos-reservations-server.ts` | `seatPosReservation` helper |
| `apps/web/app/api/pos/reservations/seat/route.ts` | POST seat (open session + seated) |
| `Tests/GwadaPOSTests/PosReservationSeatTests.swift` | Policy + HubState |

---

### Task 1: Policy + HubState seat mutation + unit tests

**Files:**
- Create: `apps/pos/Sources/Store/PosReservationSeat.swift`
- Modify: `apps/pos/Sources/Store/PosHubState.swift`
- Modify: `apps/pos/Sources/Store/PosReservationsStore.swift`
- Test: `apps/pos/Tests/GwadaPOSTests/PosReservationSeatTests.swift`

**Interfaces:**
- Produces:
  ```swift
  enum PosReservationSeatError: Error, Equatable {
      case reservationNotFound
      case invalidStatus
      case tableNotFound
      case tableOccupied
      case missingIdempotencyKey
  }

  enum PosReservationSeatResult: Equatable {
      case ok(tableSessionId: String, diningTableId: String, idempotentReplay: Bool)
  }

  enum PosReservationSeatPolicy {
      static func canSeat(statusCode: String?) -> Bool {
          statusCode == "confirmed"
      }
  }
  ```
- Produces on `PosReservationsStore`:
  ```swift
  /// Updates cached reservation to seated + diningTableId; returns false if not found.
  @discardableResult
  func markSeated(reservationId: String, diningTableId: String, dayYmd: String?) -> Bool
  ```
- Produces on `PosHubState`:
  ```swift
  func seatLocalReservation(
      reservationId: String,
      diningTableId: String,
      coverCount: Int,
      dayYmd: String?,
      idempotencyKey: String
  ) -> Result<PosReservationSeatResult, PosReservationSeatError>
  ```

- [ ] **Step 1: Write failing tests**

```swift
func testPolicy_onlyConfirmed() {
    XCTAssertTrue(PosReservationSeatPolicy.canSeat(statusCode: "confirmed"))
    XCTAssertFalse(PosReservationSeatPolicy.canSeat(statusCode: "pending"))
    XCTAssertFalse(PosReservationSeatPolicy.canSeat(statusCode: "seated"))
    XCTAssertFalse(PosReservationSeatPolicy.canSeat(statusCode: nil))
}

func testSeat_occupiedTable_fails() {
    // bootstrap with open session on table T1 + confirmed resa in PosReservationsStore
    // seatLocalReservation → .failure(.tableOccupied)
}

func testSeat_freeTable_opensSessionAndMarksSeated() {
    // free T1, confirmed resa → .ok; openSessionId(forDiningTableId: T1) non-nil
    // store reservation status code == "seated", diningTableId == T1
}

func testSeat_idempotent() {
    // same key twice → second idempotentReplay == true, one session
}
```

- [ ] **Step 2: Run tests — expect fail (types missing)**

```bash
cd apps/pos && xcodebuild test -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -only-testing:GwadaPOSTests/PosReservationSeatTests
```

Expected: compile error `cannot find 'PosReservationSeatPolicy'`

- [ ] **Step 3: Implement policy + store markSeated + HubState.seatLocalReservation**

Logic sketch for `seatLocalReservation`:
1. Trim `idempotencyKey`; empty → `.missingIdempotencyKey`.
2. If key already consumed → return prior session/table with `idempotentReplay: true` (store map `idempotencyKey → (sessionId, tableId)` like void).
3. Load reservation from `PosReservationsStore` (selected day or `dayYmd`); missing → `.reservationNotFound`.
4. `canSeat(status.code)` false → `.invalidStatus`.
5. Table must exist in bootstrap floor and `is_active`; else `.tableNotFound`.
6. If `openSessionId(forDiningTableId:)` non-nil → `.tableOccupied`.
7. `sessionId = openLocalSession(diningTableId:coverCount:)`.
8. Persist optional local map `sessionId → reservationId` if needed for later (UserDefaults/`PosLocalStore` key `sessionReservationMap`); minimal: keep in HubState private dict.
9. `PosReservationsStore.markSeated(...)` — set status to day’s status with code `seated` (lookup in `day.statuses`), set `diningTableId` + table label fields if available.
10. Record idempotency; return `.ok`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit** (only if user asks)

---

### Task 2: LAN path + Hub handler + Handheld client

**Files:**
- Modify: `apps/pos/Sources/LAN/PosLanProtocol.swift`
- Modify: `apps/pos/Sources/LAN/HandheldHubClient.swift`
- Modify: `apps/pos/Sources/App/PosRuntime.swift` (handler only)
- Test: extend `PosReservationSeatTests` or `PosLanAuthTests` for path token requirement

**Interfaces:**
- Produces: `PosLanProtocol.seatReservationPath = "/v1/reservations/seat"`
- Produces:
  ```swift
  // HandheldHubClient
  static func seatReservation(
      baseURL: URL,
      pairToken: String?,
      reservationId: String,
      diningTableId: String,
      coverCount: Int,
      idempotencyKey: String,
      staffId: String?,
      staffSessionId: String?,
      staffSessionHeader: String?
  ) async throws -> (tableSessionId: String, diningTableId: String)
  ```

- [ ] **Step 1: Failing test path constant + requiresToken**

```swift
func testSeatReservationPath_matchesLANContract() {
    XCTAssertEqual(PosLanProtocol.seatReservationPath, "/v1/reservations/seat")
    XCTAssertTrue(PosLanAuth.requiresToken(pathOnly: PosLanProtocol.seatReservationPath))
}
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Add path; implement client POST JSON; Hub handler**

Handler rules (mirror void/collect):
- Decode body: `reservationId`, `diningTableId`, `coverCount`, `idempotencyKey`, optional `staffId`/`staffSessionId`.
- Production: Staff-Proof via `PosLanVoidAuth`-style helpers **or** shared extract — reuse `PosLanVoidAuth.authenticatedStaffId` / `hasStaffProof` + `allowsHubCollectWithoutStaffSession`.
- Call `PosHubState.shared.seatLocalReservation(...)`.
- On success (non-replay): enqueue sync (Task 3 may stub enqueue first — if Task 3 not done, enqueue no-op stub or skip until Task 3; prefer implement enqueue signature in Task 3 first if blocked).
- Map errors to HTTP: 404/409/400/403.
- Response: `{ "ok": true, "tableSessionId": "…", "diningTableId": "…" }`.

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit** (only if user asks)

---

### Task 3: Sync queue + Cloud open/seat API

**Files:**
- Modify: `apps/pos/Sources/Store/PosSyncQueue.swift`
- Modify: `apps/pos/Sources/Cloud/PosCloudClient.swift`
- Create: `apps/web/lib/pos/pos-seat-reservation-server.ts` (or extend `pos-reservations-server.ts`)
- Create: `apps/web/app/api/pos/reservations/seat/route.ts`
- Modify: `apps/web/app/api/pos/table-sessions/route.ts` only if extending open body is enough — **prefer dedicated seat route** that does open+status atomically
- Test: Swift Codable round-trip; optional web unit if existing pattern

**Interfaces:**
- Produces:
  ```swift
  // PosSyncQueue.Kind
  case reservationSeated

  struct PosSyncReservationSeatedPayload: Codable, Sendable {
      var restaurantId: String
      var reservationId: String
      var diningTableId: String
      var coverCount: Int
      var localSessionId: String
      var idempotencyKey: String
  }
  ```
- Cloud:
  ```swift
  static func seatReservation(
      restaurantId: String,
      reservationId: String,
      diningTableId: String,
      coverCount: Int,
      localSessionId: String?,
      idempotencyKey: String
  ) async throws -> String // cloud sessionId
  ```
- Web `POST /api/pos/reservations/seat`:
  - Auth: `authorizePosRestaurant`
  - Body: restaurantId, reservationId, diningTableId, coverCount, localSessionId?, idempotencyKey?
  - Server: verify reservation `confirmed`; if table has open session conflict → 409; `openPosTableSession(..., reservationId)`; set status `seated` + dining_table_id (reuse display mutation helpers under admin/POS supabase); return `{ sessionId }`
  - Idempotent: if session already linked to reservationId → return that sessionId

- [ ] **Step 1: Swift failing Codable + enqueue-once test** (like line void)

- [ ] **Step 2: Implement payload, enqueue, Nest stub / Next flush calling `PosCloudClient.seatReservation`**

Wire Nest path: if Nest configured, map event name `reservation.seated`; else Next `POST /api/pos/reservations/seat`.

- [ ] **Step 3: Implement web seat route + server helper**

Reuse:
- `openPosTableSession` from `pos-order-server.ts`
- Status update: find seated status id for restaurant, update `reservations` row (mirror `updateDisplayReservationStatus` / table assign — prefer calling shared functions rather than duplicating SQL)

- [ ] **Step 4: Extend `PosCloudClient.openTableSession` is NOT required if seat route handles both**

- [ ] **Step 5: Tests PASS; manual curl against Dev optional**

- [ ] **Step 6: Commit** (only if user asks)

---

### Task 4: PosRuntime.seatReservation + UI sheet + wire Timeline/Floor

**Files:**
- Modify: `apps/pos/Sources/App/PosRuntime.swift`
- Create: `apps/pos/Sources/UI/ReservationSeatSheet.swift`
- Modify: `apps/pos/Sources/UI/ReservationsView.swift`
- Modify: `apps/pos/Sources/UI/TablesHomeView.swift`
- Modify Hub handler from Task 2 to call `enqueueReservationSeated` on success

**Interfaces:**
- Produces:
  ```swift
  @MainActor
  @discardableResult
  func seatReservation(
      reservationId: String,
      diningTableId: String,
      coverCount: Int,
      dayYmd: String? = nil
  ) async -> String? // tableSessionId on success
  ```

Flow:
1. Build `idempotencyKey = UUID().uuidString`.
2. If handheld paired: `HandheldHubClient.seatReservation` + Staff-Proof from PIN; on success mirror with `seatLocalReservation` (like void mirror) **or** rely on snapshot refresh + local seat mirror — **must** update local open session + resa cache (mirror pattern).
3. Else if local hub floor: `seatLocalReservation` + enqueue sync + flush + publishSnapshot.
4. Else: status „Kasse getrennt“ / block.
5. Return sessionId; UI navigates to table.

**UI `ReservationSeatSheet`:**
- Inputs: `PosReservationDto`, free tables list, `onConfirm(diningTableId)`, `onCancel`.
- If `reservation.diningTableId` in free tables → show Confirm „Tisch X platzieren“.
- Else list free tables (like `WalkInSheet`); prefer capacity ≥ partySize (sort, don’t hard-block).
- Busy / error text for occupied race.

**ReservationsView:**
- On `confirmed` card: Button „Platzieren“ → present sheet → on success dismiss + navigate (callback/`runtime` selected table). Use existing navigation to table session if available; else set published `pendingOpenTableId`.

**TablesHomeView:**
- Make reservation hint a `Button` → same sheet with that reservation id (resolve from store by id).

- [ ] **Step 1: Runtime method + sheet (compile)**

- [ ] **Step 2: Wire both entry points**

- [ ] **Step 3: Manual acceptance checklist from spec**

- [ ] **Step 4: Commit** (only if user asks)

---

### Task 5: Acceptance polish + regression

- [ ] **Step 1: Run full `PosReservationSeatTests` + `PosLineVoidTests` (no regress)**

```bash
cd apps/pos && xcodebuild test -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' \
  -only-testing:GwadaPOSTests/PosReservationSeatTests \
  -only-testing:GwadaPOSTests/PosLineVoidTests
```

Expected: all PASS

- [ ] **Step 2: Device/sim smoke** — Solo: create confirmed demo/cloud resa → Platzieren → session + seated in UI

- [ ] **Step 3: Commit** (only if user asks)

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Timeline + Floor entry | T4 |
| confirmed only | T1 policy |
| Assigned table direct / else picker | T4 sheet |
| Occupied → abort | T1 + T2 HTTP 409 |
| Open session + reservationId + seated | T1 local, T3 cloud |
| Hub-LAN SoT + Sync | T2 + T3 |
| Staff-Proof production | T2 handler |
| Navigate to session | T4 |
| Idempotency | T1 + T3 |
| Nicht-Ziele (merge/pending/seated-jump) | out of scope |

## Placeholder scan

None intentional — sync event fixed as `reservation.seated` / kind `reservationSeated`.
