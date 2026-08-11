# POS Kellner-Portemonnaie + Schichtübergabe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pro Kellner ein Portemonnaie unter der Restaurant-Kasse: Wechselgeld aus der Kasse, Bar-Kassierungen erhöhen das Soll des Kassierers, Schichtübergabe (Tische ± Börse), Pflichtzählung am Schichtende mit Manager-PIN bei großer Differenz.

**Architecture:** Fiskalische SoT bleibt `pos_register_sessions`. Neue Tabellen `pos_waiter_cash_bags` + `pos_waiter_cash_bag_movements` (append-only). Hub/Solo mutieren lokal und syncen; Handheld über LAN. Bar-Collect schreibt Movement `cash_sale` und verlangt offene Börse. Z-Soll = Opening + Cash-Sales − Float-outs + Drops.

**Tech Stack:** Postgres/Supabase migrations, Next.js POS APIs (`apps/web`), Nest Sync/Shifts (`apps/pos-api`), SwiftUI POS (`apps/pos`), XCTest

**Spec:** `docs/superpowers/specs/2026-08-11-pos-waiter-cash-bag-handover-design.md`

## Global Constraints

- Ansatz 1: Börse = Unterbuch der offenen Register-Session (keine TSE pro Kellner).
- Wechselgeld = gebuchte Ausgabe Kasse → Börse (`float_out`).
- Bar-Kassierung → Börse des **Kassierers** (PIN); ohne offene Börse **blockieren**.
- Schichtübergabe Default nur Tische; optional Checkbox „mit Börse“ (Soll-Übernahme, kein Diff-Zwang).
- Schichtende: Pflicht Ist vs. Soll; Default-Schwelle **500 Cent**; darüber Manager-PIN.
- Journal append-only; Storno nur Gegenbuchung.
- Drop-UI = v1.1 (Movement-Kind trotzdem in Schema).
- Dev-DB: nach Migration `pnpm db:push` (nicht live, nicht local Docker außer explizit).
- Commits nur wenn der User explizit committen lässt (Repo-Regel).
- Realtime/Soft-Nav-Regeln unberührt; keine route-conditional Realtime-Provider.

---

## File map

| File | Role |
|------|------|
| `supabase/migrations/20260811100000_pos_waiter_cash_bags.sql` | Bags, movements, settings, payment cashier cols |
| `apps/web/lib/pos/waiter-cash-bag-server.ts` | Issue / close / list / apply cash_sale / handover |
| `apps/web/lib/pos/register-report-aggregate.ts` | `computeExpectedCashCents` inkl. float/drop |
| `apps/web/app/api/pos/cash-bags/**` | REST issue/close/list |
| `apps/web/lib/pos/pos-session-settlement-server.ts` | Collect → cashier bag |
| `apps/pos-api/src/shifts/shifts.service.ts` | `transferCashBag` flag |
| `apps/pos-api/src/sync/sync.service.ts` | Sync kinds for bag events |
| `apps/pos/Sources/Store/PosWaiterCashBag.swift` | Types, Soll-Formel, errors |
| `apps/pos/Sources/Store/PosHubState.swift` | Local bag store + mutations |
| `apps/pos/Sources/Store/PosSyncQueue.swift` | New sync kinds |
| `apps/pos/Sources/Cloud/PosCloudClient.swift` | Cloud bag endpoints |
| `apps/pos/Sources/LAN/PosLanProtocol.swift` | LAN paths |
| `apps/pos/Sources/LAN/HandheldHubClient.swift` | LAN clients |
| `apps/pos/Sources/App/PosRuntime.swift` | Runtime + Hub HTTP |
| `apps/pos/Sources/UI/CashBagIssueSheet.swift` | Hub: Wechselgeld ausgeben |
| `apps/pos/Sources/UI/CashBagCloseSheet.swift` | Handheld: zählen/schließen |
| `apps/pos/Sources/UI/ShiftHandoverSheet.swift` | Übergabe ± Börse |
| `apps/pos/Sources/UI/MoreMenuView.swift` | Einstiege Schicht/Kasse |
| `apps/pos/Sources/UI/TableSessionView.swift` | Menü Schichtübergabe |
| `apps/pos/Tests/GwadaPOSTests/PosWaiterCashBagTests.swift` | Unit |
| `apps/pos/Tests/GwadaPOSUITests/CashBagHandoverUITests.swift` | UI smoke |

---

### Task 1: Schema — bags, movements, settings, payment cashier

**Files:**
- Create: `supabase/migrations/20260811100000_pos_waiter_cash_bags.sql`
- Verify: `pnpm db:push`

**Interfaces:**
- Produces tables:
  - `pos_waiter_cash_bags`
  - `pos_waiter_cash_bag_movements`
- Produces columns on `pos_payments`: `cashier_profile_id uuid null`, `cash_bag_id uuid null`
- Produces restaurant setting key (JSONB on existing fiscal/settings table **or** dedicated column): `waiter_cash_bag_diff_threshold_cents` default `500`
  - Prefer: column on `pos_restaurant_fiscal_config`: `waiter_cash_bag_diff_threshold_cents bigint not null default 500`

- [ ] **Step 1: Write migration**

```sql
-- pos_waiter_cash_bags
create table public.pos_waiter_cash_bags (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  register_session_id uuid not null references public.pos_register_sessions (id) on delete restrict,
  staff_profile_id uuid not null,
  status text not null check (status in ('open', 'handed_over', 'closed')),
  opening_float_cents bigint not null check (opening_float_cents >= 0),
  closing_count_cents bigint null check (closing_count_cents is null or closing_count_cents >= 0),
  difference_cents bigint null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz null,
  opened_by_profile_id uuid null,
  closed_by_profile_id uuid null,
  manager_override_profile_id uuid null,
  handed_over_to_bag_id uuid null references public.pos_waiter_cash_bags (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index pos_waiter_cash_bags_one_open_per_staff
  on public.pos_waiter_cash_bags (restaurant_id, staff_profile_id)
  where status = 'open';

create index pos_waiter_cash_bags_register_idx
  on public.pos_waiter_cash_bags (register_session_id);

create table public.pos_waiter_cash_bag_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  cash_bag_id uuid not null references public.pos_waiter_cash_bags (id) on delete cascade,
  register_session_id uuid not null references public.pos_register_sessions (id) on delete restrict,
  kind text not null check (kind in (
    'float_out', 'cash_sale', 'drop_in', 'handover', 'close_count'
  )),
  amount_cents bigint not null,
  -- float_out/cash_sale/drop_in: signed effect on bag (+/-); close_count stores counted Ist
  payment_id uuid null,
  idempotency_key text null,
  note text null,
  created_by_profile_id uuid null,
  created_at timestamptz not null default now()
);

create unique index pos_waiter_cash_bag_movements_idem
  on public.pos_waiter_cash_bag_movements (restaurant_id, idempotency_key)
  where idempotency_key is not null;

alter table public.pos_payments
  add column if not exists cashier_profile_id uuid null,
  add column if not exists cash_bag_id uuid null
    references public.pos_waiter_cash_bags (id) on delete set null;

alter table public.pos_restaurant_fiscal_config
  add column if not exists waiter_cash_bag_diff_threshold_cents bigint not null default 500
    check (waiter_cash_bag_diff_threshold_cents >= 0);

-- RLS: staff select for restaurant; writes via service role / Nest only (mirror register_sessions)
```

Adjust `restaurants` FK to the actual restaurants/locations table used by `pos_register_sessions.restaurant_id` (copy from that migration).

- [ ] **Step 2: Push Dev-DB**

Run: `pnpm db:push`  
Expected: migration applied, no error.

- [ ] **Step 3: Commit only if user asked**

---

### Task 2: Server domain — Soll-Formel + bag helpers

**Files:**
- Create: `apps/web/lib/pos/waiter-cash-bag-server.ts`
- Modify: `apps/web/lib/pos/register-report-aggregate.ts` (`computeExpectedCashCents`)
- Test: `apps/web/lib/pos/__tests__/waiter-cash-bag-server.test.ts` (or existing vitest pattern)

**Interfaces:**
- Produces:
```ts
export type CashBagStatus = "open" | "handed_over" | "closed";

export function bagExpectedCents(params: {
  openingFloatCents: number;
  movements: { kind: string; amount_cents: number }[];
}): number;

export async function issueWaiterCashBag(params: {
  restaurantId: string;
  staffProfileId: string;
  openingFloatCents: number;
  issuedByProfileId: string;
  idempotencyKey: string;
}): Promise<{ ok: true; bagId: string } | { ok: false; error: string; status: number }>;

export async function closeWaiterCashBag(params: {
  restaurantId: string;
  bagId: string;
  closingCountCents: number;
  closedByProfileId: string;
  managerOverrideProfileId?: string | null;
  managerPinVerified: boolean;
}): Promise<{ ok: true; differenceCents: number } | { ok: false; error: string; status: number }>;

export async function applyCashSaleToOpenBag(params: {
  restaurantId: string;
  cashierProfileId: string;
  paymentId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<{ ok: true; bagId: string } | { ok: false; error: string; status: number }>;

export async function handoverCashBag(params: {
  restaurantId: string;
  fromProfileId: string;
  toProfileId: string;
}): Promise<{ ok: true; toBagId: string } | { ok: false; error: string; status: number }>;
```

- [ ] **Step 1: Failing unit test for Soll**

```ts
import { describe, expect, it } from "vitest";
import { bagExpectedCents } from "../waiter-cash-bag-server";

describe("bagExpectedCents", () => {
  it("start + sales - drops", () => {
    expect(
      bagExpectedCents({
        openingFloatCents: 10_000,
        movements: [
          { kind: "float_out", amount_cents: 10_000 }, // informational; opening already set
          { kind: "cash_sale", amount_cents: 5_000 },
          { kind: "drop_in", amount_cents: 2_000 },
        ],
      }),
    ).toBe(13_000); // 100 + 50 - 20
  });
});
```

Define clearly: **Soll = opening_float_cents + sum(cash_sale) − sum(drop_in)`**; `float_out` movement records the issue but does **not** double-count if `opening_float_cents` already stores it.

- [ ] **Step 2: Run test — expect FAIL**

Run: `pnpm exec vitest run apps/web/lib/pos/__tests__/waiter-cash-bag-server.test.ts`  
(or repo’s usual vitest filter)

- [ ] **Step 3: Implement helpers + expected register cash**

```ts
// register-report-aggregate.ts — extend computeExpectedCashCents:
// return opening + cashSales - floatOuts + dropIns
// floatOuts/dropIns: sum movements for register_session_id in window
```

```ts
export function bagExpectedCents(params: {
  openingFloatCents: number;
  movements: { kind: string; amount_cents: number }[];
}): number {
  let sales = 0;
  let drops = 0;
  for (const m of params.movements) {
    if (m.kind === "cash_sale") sales += m.amount_cents;
    if (m.kind === "drop_in") drops += m.amount_cents;
  }
  return params.openingFloatCents + sales - drops;
}
```

`issueWaiterCashBag`: require open register; reject if staff already has `open` bag; insert bag + `float_out` movement with idempotency.

`closeWaiterCashBag`: compute expected; diff = count − expected; if `Math.abs(diff) >= threshold` require `managerPinVerified`; set closed + `close_count` movement.

`applyCashSaleToOpenBag`: find open bag for cashier; else `{ error: "no_open_bag", status: 409 }`.

`handoverCashBag`: reject if to already has open bag; mark from `handed_over`; create to bag with same expected as opening_float of new bag (= previous expected) + `handover` movements.

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit only if user asked**

---

### Task 3: HTTP APIs + wire collectCash

**Files:**
- Create: `apps/web/app/api/pos/cash-bags/issue/route.ts`
- Create: `apps/web/app/api/pos/cash-bags/close/route.ts`
- Create: `apps/web/app/api/pos/cash-bags/route.ts` (list open for restaurant)
- Modify: `apps/web/lib/pos/pos-session-settlement-server.ts` (after successful cash payment)
- Modify: Nest collect path if payments go through `apps/pos-api` (`orders.service.ts` / settlement) — **both** paths that create cash `pos_payments` must call `applyCashSaleToOpenBag`

**Interfaces:**
- `POST /api/pos/cash-bags/issue` body `{ staffProfileId, openingFloatCents, idempotencyKey }`
- `POST /api/pos/cash-bags/close` body `{ bagId, closingCountCents, managerPin? }`
- `GET /api/pos/cash-bags?status=open`
- Collect: on success set `cashier_profile_id`, `cash_bag_id`; if no bag → fail collect **before** payment finalize (transactional)

- [ ] **Step 1: Issue/close/list routes** using existing POS auth helpers (device bearer / staff session — mirror `register/open`).

- [ ] **Step 2: Gate collect**

Pseudo:

```ts
const bag = await applyCashSaleToOpenBag({...});
if (!bag.ok) return { error: bag.error, status: 409 }; // no_open_bag
// proceed settlement; persist payment.cashier_profile_id + cash_bag_id
```

- [ ] **Step 3: Manual/API test**

With open register + issued bag: collect 1 cash → movement `cash_sale` exists.  
Without bag: collect returns `no_open_bag`.

- [ ] **Step 4: Commit only if user asked**

---

### Task 4: Nest shift transfer + Sync events

**Files:**
- Modify: `apps/pos-api/src/shifts/shifts.service.ts`
- Modify: `apps/pos-api/src/shifts/shifts.controller.ts`
- Modify: `apps/pos-api/src/sync/sync.service.ts`
- Create or reuse web helper from Nest via duplicated thin service if Nest cannot import web lib — **prefer** shared logic in `apps/pos-api/src/cash-bags/cash-bags.service.ts` mirroring server helpers (keep in sync) OR call Supabase directly with same rules as Task 2.

**Interfaces:**
```ts
// transferSessions params add:
transferCashBag?: boolean;

// Sync event names (queue kinds):
// cash_bag.issued | cash_bag.closed | cash_bag.handover | (cash_sale via payment sync)
```

- [ ] **Step 1: Extend transfer**

After successful owner update, if `transferCashBag`:

```ts
const hand = await cashBags.handover({
  restaurantId,
  fromProfileId: params.fromProfileId,
  toProfileId: params.toProfileId,
});
if (!hand.ok) return hand; // rollback owners if needed — use single DB transaction
```

Use a transaction: owners + bag handover atomic.

- [ ] **Step 2: Sync handlers** for issued/closed/handover payloads (idempotent by `idempotencyKey`).

- [ ] **Step 3: Unit/integration test Nest transfer with `transferCashBag: true`.

- [ ] **Step 4: Commit only if user asked**

---

### Task 5: Swift domain + HubState local bags

**Files:**
- Create: `apps/pos/Sources/Store/PosWaiterCashBag.swift`
- Modify: `apps/pos/Sources/Store/PosHubState.swift`
- Modify: `apps/pos/project.yml` if new file not auto-globbed
- Test: `apps/pos/Tests/GwadaPOSTests/PosWaiterCashBagTests.swift`

**Interfaces:**
```swift
enum PosCashBagStatus: String, Codable { case open, handedOver = "handed_over", closed }

struct PosWaiterCashBag: Identifiable, Codable, Equatable {
    var id: String
    var staffProfileId: String
    var registerSessionId: String
    var status: PosCashBagStatus
    var openingFloatCents: Int
    var closingCountCents: Int?
    var differenceCents: Int?
}

struct PosCashBagMovement: Codable, Equatable {
    var id: String
    var cashBagId: String
    var kind: String // float_out | cash_sale | drop_in | handover | close_count
    var amountCents: Int
    var idempotencyKey: String?
}

enum PosCashBagError: Error, Equatable {
    case noOpenRegister
    case alreadyOpen
    case noOpenBag
    case targetHasOpenBag
    case managerPinRequired
    case invalidAmount
}

enum PosCashBagMath {
    static func expectedCents(openingFloatCents: Int, movements: [PosCashBagMovement]) -> Int
}

// PosHubState:
func issueLocalCashBag(staffProfileId: String, openingFloatCents: Int, issuedBy: String, idempotencyKey: String) -> Result<PosWaiterCashBag, PosCashBagError>
func applyLocalCashSale(cashierProfileId: String, amountCents: Int, paymentId: String, idempotencyKey: String) -> Result<String, PosCashBagError>
func closeLocalCashBag(bagId: String, countCents: Int, thresholdCents: Int, managerOverride: Bool) -> Result<Int, PosCashBagError>
func handoverLocalCashBag(from: String, to: String) -> Result<PosWaiterCashBag, PosCashBagError>
func openCashBag(for staffProfileId: String) -> PosWaiterCashBag?
```

Persist bags in `PosLocalStore` (new keys) alongside bootstrap.

- [ ] **Step 1: Failing XCTest** for `PosCashBagMath.expectedCents` and `issueLocalCashBag` unique-open.

- [ ] **Step 2: Implement types + HubState** until green.

Run:  
`xcodebuild test -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17' -only-testing:GwadaPOSTests/PosWaiterCashBagTests`

- [ ] **Step 3: Commit only if user asked**

---

### Task 6: Sync queue + Cloud client

**Files:**
- Modify: `apps/pos/Sources/Store/PosSyncQueue.swift`
- Modify: `apps/pos/Sources/Cloud/PosCloudClient.swift`

**Interfaces:**
```swift
enum PosSyncQueueItemKind {
    // existing...
    case cashBagIssued
    case cashBagClosed
    case cashBagHandover
}

struct PosSyncCashBagIssuedPayload: Codable {
    var restaurantId: String
    var bagId: String
    var staffProfileId: String
    var openingFloatCents: Int
    var idempotencyKey: String
}
// similarly Closed + Handover
```

- [ ] **Step 1: Add kinds + enqueue + flush** to Nest/Web endpoints from Task 3/4.

- [ ] **Step 2: Unit decode/round-trip payload test.**

- [ ] **Step 3: Commit only if user asked**

---

### Task 7: LAN + PosRuntime wiring

**Files:**
- Modify: `apps/pos/Sources/LAN/PosLanProtocol.swift`
- Modify: `apps/pos/Sources/LAN/HandheldHubClient.swift`
- Modify: `apps/pos/Sources/App/PosRuntime.swift`

**Interfaces:**
```swift
// PosLanProtocol
static let cashBagIssuePath = "/v1/cash-bags/issue"
static let cashBagClosePath = "/v1/cash-bags/close"
static let cashBagHandoverPath = "/v1/cash-bags/handover"

// PosRuntime
func issueCashBag(staffProfileId: String, openingFloatCents: Int) async -> Bool
func closeCashBag(bagId: String, closingCountCents: Int, managerPin: String?) async -> Bool
func transferShift(sessionIds: [String], toProfileId: String, toPin: String, transferCashBag: Bool) async -> Bool
// collectCash / collect path: call applyLocalCashSale / LAN; block with statusMessage if no bag
var openCashBagExpectedCents: Int? { get }
```

Hub HTTP handlers: mirror merge/move — mutate HubState, enqueue sync **before** 200 ack where persistence matters.

Handheld: LAN when paired; Solo/Hub local when `shouldPublishLocalHubFloor`.

- [ ] **Step 1: Protocol + client methods.**

- [ ] **Step 2: Hub handlers + Runtime methods.**

- [ ] **Step 3: Gate Kassieren** — if `openCashBag(for: currentStaff) == nil` → do not collect; `statusMessage = "Zuerst Wechselgeld / Börse öffnen."`

- [ ] **Step 4: Unit test LAN path constants + Runtime gate message (if testable).**

- [ ] **Step 5: Commit only if user asked**

---

### Task 8: UI — Issue, Close, Collect blocker

**Files:**
- Create: `apps/pos/Sources/UI/CashBagIssueSheet.swift`
- Create: `apps/pos/Sources/UI/CashBagCloseSheet.swift`
- Modify: `apps/pos/Sources/UI/MoreMenuView.swift`
- Modify: collect/kassieren UI to surface blocker (`statusMessage` / alert)

**UI copy (German):**
- Issue: „Wechselgeld ausgeben“, Kellner-Picker, Betrag (Default 10000 cent display 100,00 €)
- Close: „Schicht beenden“, zeigt Soll, Eingabe Ist, bei Diff ≥ Schwelle Manager-PIN-Feld
- Accessibility: `pos.cashBag.issueSheet`, `pos.cashBag.closeSheet`, `pos.cashBag.closeConfirm`

- [ ] **Step 1: Issue sheet + Hub More entry** (only when `role == .hub` or solo with kasse rights).

- [ ] **Step 2: Close sheet + Mehr → Schicht beenden.**

- [ ] **Step 3: Manual Simulator:** open register (existing) → issue 100 → collect requires bag → close with equal count.

- [ ] **Step 4: Commit only if user asked**

---

### Task 9: UI — Schichtübergabe ± Börse

**Files:**
- Create: `apps/pos/Sources/UI/ShiftHandoverSheet.swift`
- Modify: `apps/pos/Sources/UI/TableSessionView.swift` (menu entry)
- Modify: `apps/pos/Sources/UI/MoreMenuView.swift` (optional: alle meine Tische übergeben)

**UI:**
1. Empfänger wählen (PIN-Cache waiters) + PIN-Feld
2. Toggle/Checkbox **„Portemonnaie mitübergeben“** (default off)
3. Confirm → `runtime.transferShift(..., transferCashBag:)`
4. Accessibility: `pos.shift.handoverSheet`, `pos.shift.handoverTransferBag`

- [ ] **Step 1: Sheet + menu „Schichtübergabe“.**

- [ ] **Step 2: Simulator:** two waiters (DEBUG pins) — transfer tables only; then with bag and assert from bag `handed_over`.

- [ ] **Step 3: Commit only if user asked**

---

### Task 10: UITest acceptance + Anleitung smoke

**Files:**
- Create: `apps/pos/Tests/GwadaPOSUITests/CashBagHandoverUITests.swift`
- Optional: link Anleitung section in More → Hilfe only if trivial; otherwise keep docs-only

**Test flow (Solo DEBUG):**
1. Reset enrollment → Solo
2. Ensure register open / issue bag via UI (or launch arg seed if needed — prefer real UI)
3. Occupy Tisch 1, cash collect path if available in UITest **or** assert issue+close sheets
4. Open handover sheet, assert checkbox exists
5. Screenshots to `/tmp/gwada-pos-ui-shots-cashbag/`

If full cash collect UITest is too brittle, split:
- UITest: issue sheet + close sheet math display
- Unit: handover + collect gate (already Task 5/7)

- [ ] **Step 1: Write UITest for issue → close happy path (Soll=Ist).**

- [ ] **Step 2: Run:**

```bash
cd apps/pos && xcodebuild test -scheme GwadaPOS \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:GwadaPOSUITests/CashBagHandoverUITests \
  -only-testing:GwadaPOSTests/PosWaiterCashBagTests
```

Expected: TEST SUCCEEDED

- [ ] **Step 3: Commit only if user asked**

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Tables bags + movements | 1 |
| float_out from register | 2–3, 5, 8 |
| cash_sale → cashier bag | 2–3, 5, 7 |
| Block collect without bag | 3, 7 |
| Handover ± bag | 4, 5, 9 |
| Close + manager PIN threshold | 2, 5, 8 |
| Expected register cash − floats + drops | 2 |
| Drop UI v1.1 only | schema kind in 1; no UI task |
| Anleitung | Spec (done); ops via UI tasks 8–9 |
| LAN/Hub/Solo | 7 |
| Append-only journal | 1–2 |

## Placeholder / consistency self-check

- Soll-Formel einheitlich: `opening + cash_sale − drop_in` (float_out not double-counted).
- Sync event names fixed above; use same strings in Nest + Swift.
- `handed_over` status spelling matches DB check constraint.
- No live `db:push:live` in plan.

---

## Execution

Plan saved to `docs/superpowers/plans/2026-08-11-pos-waiter-cash-bag-handover.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — frischer Subagent pro Task, Review dazwischen  
2. **Inline Execution** — Tasks in dieser Session mit Checkpoints  

Which approach?
