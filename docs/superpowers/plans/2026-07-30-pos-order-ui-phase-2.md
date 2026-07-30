# POS Order-UI Phase 2 (Bestellaufnahme) — Implementierungsplan

> **For agentic workers:** Execute task-by-task in order. Keep changes scoped to Phase 2 (2a-2f). Do not pull Phase-3/4 work forward.

**Goal:** Ship the new order-intake flow in `apps/pos` with active course, one-tap add, modifier enforcement, side grid, and kitchen note.

**Spec:** `docs/superpowers/specs/2026-07-30-pos-order-ui-phase-2-design.md`

## Constraints

- iOS target remains 17.0; system fonts only.
- Course UI offers 1..3, backend remains `course >= 1`.
- No schema migration in Phase 2 unless a hard blocker appears.
- No Fire-per-course UI/state (Phase 3).
- No Liquid Glass/iOS 26 UI work (Phase 4).
- Keep Pairing/Hub flows untouched.

## Success Criteria

1. Menu grid supports fast one-tap add for simple items.
2. Modifier sheet enforces min/max rules and computes live price.
3. Side selection is available from side pool and persisted in cart line config.
4. Active course is visible and controls newly added lines.
5. Kitchen note (max 80 chars) is supported per line and persisted.
6. Existing tests pass; no pairing/onboarding regression.

---

## Task 2a — Order Screen foundation (grid + chips + badges + dock context)

**Files (expected):**
- `apps/pos/Sources/UI/TableSessionView.swift`
- `apps/pos/Sources/UI/MenuBrowserView.swift`
- `apps/pos/Sources/Cart/PosCartModels.swift` (read-only except lightweight helpers)

**Implementation:**
- Build/reshape menu area to 2-column card grid.
- Add category chips above grid with immediate in-memory filter.
- Add quantity badge per item card based on current cart lines.
- Keep existing bottom interaction area; ensure cart-open CTA remains always reachable.

**Deliverables:**
- Reusable card cell + badge rendering for menu items.
- Deterministic item ordering (stable sort).

**Verification:**
- Manual smoke on iPhone simulator: quick add across categories, no layout jumps.
- Build: `xcodebuild ... -scheme GwadaPOS ... build`.

---

## Task 2b — Active course state (1..3) and line assignment

**Files (expected):**
- `apps/pos/Sources/UI/TableSessionView.swift`
- `apps/pos/Sources/Cart/PosCartModels.swift`
- `apps/pos/Sources/UI/LineConfigureSheet.swift` (if course handoff is needed)

**Implementation:**
- Introduce `activeCourse` session-local UI state (default `2`).
- Render visible segmented/chip control for courses 1, 2, 3.
- On add-line path, assign `line.course = activeCourse`.
- Do not mutate existing line courses when `activeCourse` changes.

**Verification:**
- Add three lines under three different active courses; confirm values in cart/debug rendering.
- Existing fire call paths remain unchanged.

---

## Task 2c — One-tap add behavior

**Files (expected):**
- `apps/pos/Sources/UI/MenuBrowserView.swift`
- `apps/pos/Sources/UI/TableSessionView.swift`
- `apps/pos/Sources/UI/LineConfigureSheet.swift`

**Implementation:**
- Define simple-item predicate:
  - no option groups OR all groups optional with zero defaults,
  - no required sides.
- If simple: add line immediately (quantity +1 if merge-on-tap applies for exact same plain item).
- If not simple: open configure sheet.

**Verification:**
- Tap simple item repeatedly -> immediate count growth, no sheet.
- Tap configurable item -> sheet opens every time.

---

## Task 2d — Modifier sheet rule enforcement + live pricing

**Files (expected):**
- `apps/pos/Sources/UI/LineConfigureSheet.swift`
- `apps/pos/Sources/Menu/PosMenuSidePool.swift`
- `apps/pos/Sources/Cart/PosCartModels.swift`

**Implementation:**
- Enforce min/max per option group using existing helper primitives from Phase 1.
- Disable/soft-block extra selections once max is reached.
- Compute live line total:
  - base item price
  - option deltas
  - side totals (with existing includedCount model prepared in data)
- CTA label shows resolved live price.
- CTA disabled until all required groups are valid.

**Verification:**
- Unit-level helper tests where sensible.
- Manual: required group prevents submit until valid.
- Manual: live price changes as options toggle.

---

## Task 2e — Side grid integration in configure flow

**Files (expected):**
- `apps/pos/Sources/UI/LineConfigureSheet.swift`
- `apps/pos/Sources/Menu/PosMenuSidePool.swift`
- `apps/pos/Sources/Cloud/PosBootstrapModels.swift` (only if decode gaps appear)

**Implementation:**
- Add side section in sheet using side pool (category "Beilagen" path from Phase 1).
- Render side cards/chips with name + side price.
- Persist selected sides into cart line configuration.
- Keep side selection compatible with current sync payload shape.

**Verification:**
- Add item with sides, close/reopen edit -> selected sides remain.
- Confirm side pricing contributes to live total.

---

## Task 2f — Kitchen note (80 chars)

**Files (expected):**
- `apps/pos/Sources/UI/LineConfigureSheet.swift`
- `apps/pos/Sources/Cart/PosCartModels.swift`
- `apps/pos/Sources/App/PosRuntime.swift` (only if serialization handoff needs adjustment)

**Implementation:**
- Add optional text field for kitchen note.
- Hard limit to 80 characters.
- Show live character counter.
- Persist into line payload/line model field already used downstream (`note`/`kitchenNote` depending on current naming).

**Verification:**
- Enter 100 chars -> clipped to 80.
- Edit existing line -> note value round-trips.

---

## Cross-cutting: regression and quality gates

### Build/Test
- `cd apps/pos && xcodebuild -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build`
- `cd apps/pos && xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'`

### Manual smoke
- iPhone:
  - app launch and pairing gate still works when unpaired.
  - paired reconnect still works without manual host entry.
- Table session:
  - grid render, quick taps, modifiers, sides, notes.

### Out-of-scope checks
- Do not implement bon grouping / fire-per-course buttons yet.

---

## Commit strategy

- Prefer 3-5 focused commits:
  1. UI foundation (2a + 2b)
  2. One-tap + modifier logic (2c + 2d)
  3. Side grid + note (2e + 2f)
  4. Tests and polish

---

## Open questions to resolve during implementation

1. Exact merge behavior for repeated one-tap simple items (increment same line vs new line).
2. Pricing display format in CTA (gross line total vs delta text + total).
3. Whether side included-count is enforced now or only displayed (spec allows prepared model; strict enforcement can remain minimal if unclear).
