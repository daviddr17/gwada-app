# POS Order-UI Fundament (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Design-Tokens + System-Font-Styles + Papier-Bon-Shell, numerische Gänge (DB→API→Swift), Beilagen-Datenpfad bis Swift, Options min/max-Helper — Fundament für Order-UI Phase 2.

**Architecture:** Parallelisierbares Fundament laut Spec. Zuerst Schema-Migration (Dev-DB), dann `pos-domain` + Nest/Web, dann Swift-Modelle/Minimal-UI, parallel Design-Shell (`PosDesign` + `PaperReceiptView`). Kein neues Order-UI.

**Tech Stack:** Postgres/Supabase Migrationen, TypeScript (`@gwada/pos-domain`, Nest `apps/pos-api`, Next `apps/web`), Swift 5 / SwiftUI (`apps/pos`), XCTest, XcodeGen. iOS 17.0.

**Spec:** [`docs/superpowers/specs/2026-07-29-pos-order-ui-foundation-design.md`](../specs/2026-07-29-pos-order-ui-foundation-design.md)

## Global Constraints

- Deployment-Target iOS 17.0; Swift 5.0; nach `project.yml`-Änderung: `cd apps/pos && xcodegen generate`.
- Gang-Map Alt→Neu: `starter→1`, `main→2`, `dessert→3`, `side|drink|other→2`. Default neu: `2`. Check: `course >= 1`.
- UI-Gänge in bestehender UI: nur **1, 2, 3** (Chips). DB erlaubt `≥ 1`.
- Fonts: **nur System-Fonts** (keine `.ttf`/`.otf` committen).
- Migration: Datei unter `supabase/migrations/`, danach **`pnpm db:push`** (Dev). **Kein** `db:push:live` / Live-Deploy ohne ausdrückliche Nutzer-Anfrage.
- Package Manager: **pnpm**. Domain-Tests: `pnpm --filter @gwada/pos-domain test`.
- Swift-Build: `cd apps/pos && xcodebuild -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build`
- Swift-Tests: `cd apps/pos && xcodebuild test -project GwadaPOS.xcodeproj -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 17 Pro'`
- Keine `Co-Authored-By`-Zeilen in Commits.
- Scope-Grenze: **kein** Order-Screen-Redesign, kein ModifierSheet-Enforcement in der UI, kein Fire-pro-Gang-State, kein Liquid Glass.

---

## File Structure

**Neu:**
- `supabase/migrations/20260729213000_pos_order_course_int.sql` — Enum → Int
- `packages/pos-domain/src/course.test.ts` — Domain-Tests Gang-Normalisierung
- `apps/pos/Sources/UI/PaperReceiptView.swift` — Papier-Bon-Shell
- `apps/pos/Sources/Menu/PosMenuSidePool.swift` — Side-Pool + OptionGroup-Validity
- `apps/pos/Tests/GwadaPOSTests/PosCourseTests.swift`
- `apps/pos/Tests/GwadaPOSTests/PosMenuSidePoolTests.swift`
- `apps/pos/Tests/GwadaPOSTests/PosCloudMenuSidesCodableTests.swift`

**Geändert (Datenpfad):**
- `packages/pos-domain/src/course.ts` — Int-API
- `packages/pos-domain/src/index.ts` — Exports
- `packages/pos-domain/package.json` — Test-Script um `course.test.ts` erweitern
- `apps/pos-api/src/orders/orders.service.ts` — COURSE_MAP → Int
- `apps/pos-api/src/orders/orders.controller.ts` — Default course `2`
- `apps/pos-api/src/sync/sync.service.ts` — course Int
- `apps/web/lib/pos/pos-order-server.ts` — course Int
- `apps/web/lib/pos/pos-kds-server.ts` — courses `number[]`
- `apps/web/app/api/pos/kds/devices/route.ts` — Int-Filter
- `apps/web/components/pos/pos-kds-settings-panel.tsx` — Chips 1–3
- `apps/web/lib/pos/pos-bootstrap-server.ts` — `sidePriceCents` + `sides`

**Geändert (Swift):**
- `apps/pos/Sources/Cart/PosCartModels.swift` — `course: Int` + `PosCourse` Helpers
- `apps/pos/Sources/UI/PosDesign.swift` — Tokens, Text-Styles, `courseColor(Int)`
- `apps/pos/Sources/UI/LineConfigureSheet.swift` — ForEach 1…3
- `apps/pos/Sources/UI/KdsView.swift` — Int labels
- `apps/pos/Sources/App/PosRuntime.swift` — course Int / Defaults
- `apps/pos/Sources/UI/TableSessionView.swift` — `fireCourse(..., course: 2)`
- `apps/pos/Sources/Cloud/PosBootstrapModels.swift` — sides + KDS `courses: [Int]`
- `apps/pos/Sources/Store/PosHubState.swift` — course filter Int

---

### Task 1: DB-Migration `course` → Int

**Files:**
- Create: `supabase/migrations/20260729213000_pos_order_course_int.sql`

**Interfaces:**
- Produces: `pos_order_lines.course integer NOT NULL DEFAULT 2 CHECK (course >= 1)`; `pos_kds_devices.courses integer[] NOT NULL DEFAULT '{}'`; Typ `pos_order_course` entfernt.

- [ ] **Step 1: Write migration SQL**

Create `supabase/migrations/20260729213000_pos_order_course_int.sql`:

```sql
-- pos_order_lines.course: enum → integer (1=Vorspeise, 2=Hauptgang, 3=Dessert, …)
-- Map: starter→1, main→2, dessert→3, side|drink|other→2

alter table public.pos_order_lines
  add column if not exists course_int integer;

update public.pos_order_lines
set course_int = case course::text
  when 'starter' then 1
  when 'main' then 2
  when 'dessert' then 3
  else 2
end
where course_int is null;

alter table public.pos_order_lines
  alter column course_int set default 2;

alter table public.pos_order_lines
  alter column course_int set not null;

alter table public.pos_order_lines
  drop constraint if exists pos_order_lines_course_int_chk;

alter table public.pos_order_lines
  add constraint pos_order_lines_course_int_chk check (course_int >= 1);

alter table public.pos_order_lines
  drop column if exists course;

alter table public.pos_order_lines
  rename column course_int to course;

comment on column public.pos_order_lines.course is
  'Gang-Nummer >= 1 (UI typisch 1=Vorspeise, 2=Hauptgang, 3=Dessert)';

-- pos_kds_devices.courses: enum[] → integer[]
alter table public.pos_kds_devices
  add column if not exists courses_int integer[] not null default '{}';

update public.pos_kds_devices d
set courses_int = coalesce(
  (
    select array_agg(
      case x::text
        when 'starter' then 1
        when 'main' then 2
        when 'dessert' then 3
        else 2
      end
      order by ordinality
    )
    from unnest(d.courses) with ordinality as u(x, ordinality)
  ),
  '{}'
)
where d.courses is not null
  and cardinality(d.courses) > 0
  and cardinality(d.courses_int) = 0;

-- Geräte empty filters (already default '{}'); non-empty remapped above.
-- For rows that already had filters, force remap even if courses_int was defaulted empty:
update public.pos_kds_devices d
set courses_int = coalesce(
  (
    select array_agg(
      case x::text
        when 'starter' then 1
        when 'main' then 2
        when 'dessert' then 3
        else 2
      end
      order by ordinality
    )
    from unnest(d.courses) with ordinality as u(x, ordinality)
  ),
  '{}'
)
where cardinality(coalesce(d.courses, '{}')) > 0;

alter table public.pos_kds_devices
  drop column if exists courses;

alter table public.pos_kds_devices
  rename column courses_int to courses;

comment on column public.pos_kds_devices.courses is
  'Gang-Filter als Integer[]; leer = alle Gänge';

drop type if exists public.pos_order_course;
```

If `drop type` fails because something still references the enum, find remaining columns via `information_schema` and convert them in the same migration before dropping.

After push, update `packages/supabase/src/database.types.ts` course fields to `number` / `number[]` (manual patch or regenerate if the project has a types script).

- [ ] **Step 2: Push to Dev-DB**

Run: `pnpm db:push`

Expected: migration applied successfully (or CI `deploy-dev-db` if local tunnel fails — then `gh workflow run deploy-dev-db.yml --ref main` and watch).

- [ ] **Step 3: Spot-check Dev**

Via Studio/SQL or `psql` against Dev:

```sql
select pg_typeof(course) from public.pos_order_lines limit 1;
-- integer
select course from public.pos_order_lines limit 5;
select courses from public.pos_kds_devices limit 5;
select 1 from pg_type where typname = 'pos_order_course';
-- 0 rows
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260729213000_pos_order_course_int.sql
git commit -m "$(cat <<'EOF'
feat(pos): migrate order line courses from enum to int

UI uses 1–3; side/drink/other map to 2. Enables fire-per-course by number.
EOF
)"
```

---

### Task 2: `pos-domain` — numerischer Course

**Files:**
- Modify: `packages/pos-domain/src/course.ts`
- Modify: `packages/pos-domain/src/index.ts`
- Modify: `packages/pos-domain/package.json`
- Create: `packages/pos-domain/src/course.test.ts`

**Interfaces:**
- Consumes: Spec-Map Alt→Neu
- Produces:
  - `POS_UI_COURSES = [1, 2, 3] as const`
  - `normalizePosOrderCourse(value: unknown): number` (legacy strings + numbers; fallback `2`)
  - `isPosOrderCourse(value: unknown): value is number` (`Number.isInteger(n) && n >= 1`)
  - `posOrderCourseLabelDe(course: number): string`
  - `posOrderCourseShortLabelDe(course: number): string`
  - Deprecated aliases: keep exporting `POS_ORDER_COURSES` as `POS_UI_COURSES` **or** remove and fix all imports in Task 3–4 (preferred: remove string union; update all call sites)

- [ ] **Step 1: Write failing tests**

Create `packages/pos-domain/src/course.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizePosOrderCourse,
  isPosOrderCourse,
  posOrderCourseLabelDe,
  POS_UI_COURSES,
} from "./course.ts";

describe("normalizePosOrderCourse", () => {
  it("maps legacy enum strings", () => {
    assert.equal(normalizePosOrderCourse("starter"), 1);
    assert.equal(normalizePosOrderCourse("main"), 2);
    assert.equal(normalizePosOrderCourse("dessert"), 3);
    assert.equal(normalizePosOrderCourse("side"), 2);
    assert.equal(normalizePosOrderCourse("drink"), 2);
    assert.equal(normalizePosOrderCourse("other"), 2);
  });

  it("accepts numeric strings and numbers", () => {
    assert.equal(normalizePosOrderCourse("1"), 1);
    assert.equal(normalizePosOrderCourse(3), 3);
    assert.equal(normalizePosOrderCourse(4), 4);
  });

  it("falls back to 2", () => {
    assert.equal(normalizePosOrderCourse(null), 2);
    assert.equal(normalizePosOrderCourse("nope"), 2);
    assert.equal(normalizePosOrderCourse(0), 2);
    assert.equal(normalizePosOrderCourse(-1), 2);
  });
});

describe("isPosOrderCourse", () => {
  it("accepts integers >= 1", () => {
    assert.equal(isPosOrderCourse(1), true);
    assert.equal(isPosOrderCourse(2), true);
    assert.equal(isPosOrderCourse(9), true);
    assert.equal(isPosOrderCourse(0), false);
    assert.equal(isPosOrderCourse("main"), false);
  });
});

describe("labels", () => {
  it("labels 1–3 and Gang N", () => {
    assert.equal(posOrderCourseLabelDe(1), "Vorspeise");
    assert.equal(posOrderCourseLabelDe(2), "Hauptgang");
    assert.equal(posOrderCourseLabelDe(3), "Dessert");
    assert.equal(posOrderCourseLabelDe(4), "Gang 4");
  });

  it("UI courses are 1–3", () => {
    assert.deepEqual([...POS_UI_COURSES], [1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm --filter @gwada/pos-domain exec node --experimental-strip-types --test src/course.test.ts`

Expected: FAIL (module exports missing / wrong types).

- [ ] **Step 3: Implement `course.ts`**

Replace `packages/pos-domain/src/course.ts` with:

```ts
export const POS_UI_COURSES = [1, 2, 3] as const;

export type PosUiCourse = (typeof POS_UI_COURSES)[number];

/** Wire/DB course number (>= 1). */
export type PosOrderCourse = number;

const LEGACY_COURSE_TO_INT: Record<string, number> = {
  "1": 1,
  "2": 2,
  "3": 3,
  starter: 1,
  main: 2,
  dessert: 3,
  side: 2,
  drink: 2,
  other: 2,
};

export function isPosOrderCourse(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/** Normalize API/DB/legacy input to Int >= 1; unknown → 2 (Hauptgang). */
export function normalizePosOrderCourse(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (Object.prototype.hasOwnProperty.call(LEGACY_COURSE_TO_INT, trimmed)) {
      return LEGACY_COURSE_TO_INT[trimmed]!;
    }
    const n = Number(trimmed);
    if (Number.isInteger(n) && n >= 1) return n;
  }
  return 2;
}

export function posOrderCourseLabelDe(course: number): string {
  switch (course) {
    case 1:
      return "Vorspeise";
    case 2:
      return "Hauptgang";
    case 3:
      return "Dessert";
    default:
      return `Gang ${course}`;
  }
}

export function posOrderCourseShortLabelDe(course: number): string {
  switch (course) {
    case 1:
      return "V";
    case 2:
      return "H";
    case 3:
      return "D";
    default:
      return String(course);
  }
}

/** @deprecated Use POS_UI_COURSES — kept briefly if any import breaks mid-refactor. */
export const POS_ORDER_COURSES = POS_UI_COURSES;

/** @deprecated Use posOrderCourseLabelDe(course). */
export const POS_ORDER_COURSE_LABELS_DE: Record<number, string> = {
  1: "Vorspeise",
  2: "Hauptgang",
  3: "Dessert",
};
```

Update `packages/pos-domain/src/index.ts` exports:

```ts
export {
  POS_UI_COURSES,
  POS_ORDER_COURSES,
  POS_ORDER_COURSE_LABELS_DE,
  isPosOrderCourse,
  normalizePosOrderCourse,
  posOrderCourseLabelDe,
  posOrderCourseShortLabelDe,
  type PosOrderCourse,
  type PosUiCourse,
} from "./course";
```

Update `packages/pos-domain/package.json` test script:

```json
"test": "node --experimental-strip-types --test src/split-bill.test.ts src/course.test.ts"
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm --filter @gwada/pos-domain test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/pos-domain/src/course.ts packages/pos-domain/src/course.test.ts packages/pos-domain/src/index.ts packages/pos-domain/package.json
git commit -m "$(cat <<'EOF'
feat(pos-domain): numeric order courses with legacy string map

Replaces enum string union so Nest/Web/Swift share Int 1–3+.
EOF
)"
```

---

### Task 3: Nest + Web Order/KDS auf Int

**Files:**
- Modify: `apps/pos-api/src/orders/orders.service.ts`
- Modify: `apps/pos-api/src/orders/orders.controller.ts`
- Modify: `apps/pos-api/src/sync/sync.service.ts`
- Modify: `apps/web/lib/pos/pos-order-server.ts`
- Modify: `apps/web/lib/pos/pos-kds-server.ts`
- Modify: `apps/web/app/api/pos/kds/devices/route.ts`
- Modify: `apps/web/components/pos/pos-kds-settings-panel.tsx`

**Interfaces:**
- Consumes: `normalizePosOrderCourse`, `isPosOrderCourse`, `POS_UI_COURSES`, `posOrderCourseLabelDe` from `@gwada/pos-domain`
- Produces: Order create / fire-course / sync write `course` as number; KDS device `courses: number[]`

- [ ] **Step 1: Nest `orders.service.ts` — replace COURSE_MAP**

Remove string `COURSE_MAP`. Import:

```ts
import { normalizePosOrderCourse } from "@gwada/pos-domain";
```

In `createOrder` line build, replace:

```ts
const course = normalizePosOrderCourse(input.course);
```

In `fireCourse`, replace:

```ts
const course = normalizePosOrderCourse(params.course);
```

Ensure `.eq("course", course)` compares number to integer column.

Update `OrderLineInput.course?: string | number` (or `unknown`).

- [ ] **Step 2: Nest controller + sync defaults**

`orders.controller.ts` fire-course:

```ts
course: body.course ?? 2,
```

`sync.service.ts`: when writing course, use `normalizePosOrderCourse(p.course)` (not `String(p.course ?? "main")`).

- [ ] **Step 3: Web `pos-order-server.ts`**

Replace:

```ts
const course =
  input.course !== undefined && input.course !== null
    ? normalizePosOrderCourse(input.course)
    : 2;
```

Import `normalizePosOrderCourse` (drop `isPosOrderCourse` string usage for course assignment). Update `course?:` on input type to `number | string`.

- [ ] **Step 4: Web KDS server + API route**

In `pos-kds-server.ts`:

```ts
courses: number[];
```

When mapping rows:

```ts
courses: ((row.courses as number[] | null) ?? []).map((c) =>
  normalizePosOrderCourse(c),
),
```

In tickets filter, compare `normalizePosOrderCourse(line.course)` against `Set<number>`.

In `app/api/pos/kds/devices/route.ts`:

```ts
const courses = (body.courses ?? [])
  .map((c) => normalizePosOrderCourse(c))
  .filter((c) => c >= 1);
```

(Or filter with `isPosOrderCourse` after normalize — normalize already yields >= 1.)

- [ ] **Step 5: KDS settings panel chips 1–3**

In `pos-kds-settings-panel.tsx`:

```tsx
import {
  POS_UI_COURSES,
  posOrderCourseLabelDe,
  type PosOrderCourse,
} from "@gwada/pos-domain";
```

State: `useState<PosOrderCourse[]>([])` (numbers).

Chip loop:

```tsx
{POS_UI_COURSES.map((c) => {
  const on = courses.includes(c);
  return (
    <button
      key={c}
      type="button"
      /* same className as before */
      onClick={() =>
        setCourses((prev) =>
          on ? prev.filter((x) => x !== c) : [...prev, c],
        )
      }
    >
      {posOrderCourseLabelDe(c)}
    </button>
  );
})}
```

Display existing stations with `d.courses.map(posOrderCourseLabelDe).join(", ")`.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @gwada/pos-domain typecheck`  
Run: `pnpm --filter pos-api exec tsc --noEmit` (or workspace equivalent if defined)  
Fix any remaining `PosOrderCourse` string assumptions in web/pos-api.

- [ ] **Step 7: Commit**

```bash
git add apps/pos-api apps/web/lib/pos apps/web/app/api/pos/kds apps/web/components/pos/pos-kds-settings-panel.tsx packages/pos-domain
git commit -m "$(cat <<'EOF'
feat(pos): wire Nest and web APIs to integer courses

KDS admin chips use 1–3; fire-course and order lines store Int.
EOF
)"
```

---

### Task 4: Web-Bootstrap — Beilagen-Felder

**Files:**
- Modify: `apps/web/lib/pos/pos-bootstrap-server.ts`

**Interfaces:**
- Produces on each menu item:
  - `sidePriceCents: number | null`
  - `sides: { required: boolean; max: number; includedCount: number } | null`
- Naming aligned with Nest catalog (`max`, `includedCount`).

- [ ] **Step 1: Extend `PosBootstrapMenuItem` type**

```ts
export type PosBootstrapMenuItemSides = {
  required: boolean;
  max: number;
  includedCount: number;
};

export type PosBootstrapMenuItem = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  sidePriceCents: number | null;
  sides: PosBootstrapMenuItemSides | null;
  vatRate: number;
  categoryId: string;
  listNumber: number | null;
  optionGroupIds: string[];
  recipe: PosBootstrapRecipeIngredient[];
  active: boolean;
};
```

- [ ] **Step 2: Select side columns + config**

In the `menu_items` select string, add `side_price_cents`.

After items load, query:

```ts
const { data: sideConfigs } = await supabase
  .from("menu_item_side_config")
  .select("menu_item_id, required, max_sides, included_count")
  .eq("restaurant_id", restaurantId);

const sideByItem = new Map<string, PosBootstrapMenuItemSides>();
for (const row of sideConfigs ?? []) {
  sideByItem.set(row.menu_item_id as string, {
    required: Boolean(row.required),
    max: Number(row.max_sides),
    includedCount: Number(row.included_count),
  });
}
```

When mapping each item:

```ts
sidePriceCents:
  row.side_price_cents == null ? null : Number(row.side_price_cents),
sides: sideByItem.get(row.id as string) ?? null,
```

- [ ] **Step 3: Smoke (optional)**

If Dev server + auth available: hit bootstrap for a restaurant and confirm JSON contains `sidePriceCents` / `sides` keys on items.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/pos/pos-bootstrap-server.ts
git commit -m "$(cat <<'EOF'
feat(pos): include side price and config in POS bootstrap

Aligns web bootstrap with Nest catalog for Swift side pool.
EOF
)"
```

---

### Task 5: Swift — `PosCourse` als Int + Minimal-UI

**Files:**
- Modify: `apps/pos/Sources/Cart/PosCartModels.swift`
- Modify: `apps/pos/Sources/UI/PosDesign.swift` (`courseColor` signature — full tokens in Task 7)
- Modify: `apps/pos/Sources/UI/LineConfigureSheet.swift`
- Modify: `apps/pos/Sources/UI/KdsView.swift`
- Modify: `apps/pos/Sources/App/PosRuntime.swift`
- Modify: `apps/pos/Sources/UI/TableSessionView.swift`
- Modify: `apps/pos/Sources/Cloud/PosBootstrapModels.swift` (`PosCloudKdsDevice.courses`)
- Modify: `apps/pos/Sources/Store/PosHubState.swift`
- Create: `apps/pos/Tests/GwadaPOSTests/PosCourseTests.swift`

**Interfaces:**
- Produces: `PosCartLine.course: Int`; `enum PosCourse` namespace helpers; UI chips `PosCourse.uiCourses = [1,2,3]`; KDS `courses: [Int]`

- [ ] **Step 1: Rewrite course helpers in `PosCartModels.swift`**

Replace the `PosCourse: String` enum with:

```swift
enum PosCourse {
    static let starter = 1
    static let main = 2
    static let dessert = 3
    static let `default` = 2
    static let uiCourses: [Int] = [1, 2, 3]

    static func label(_ course: Int) -> String {
        switch course {
        case 1: return "Vorspeise"
        case 2: return "Hauptgang"
        case 3: return "Dessert"
        default: return "Gang \(course)"
        }
    }

    static func shortLabel(_ course: Int) -> String {
        switch course {
        case 1: return "V"
        case 2: return "H"
        case 3: return "D"
        default: return "\(course)"
        }
    }

    /// Legacy string or number from older snapshots.
    static func parse(_ raw: String?) -> Int {
        guard let raw else { return `default` }
        switch raw {
        case "1", "starter": return 1
        case "2", "main": return 2
        case "3", "dessert": return 3
        case "side", "drink", "other": return 2
        default:
            if let n = Int(raw), n >= 1 { return n }
            return `default`
        }
    }
}
```

Change `PosCartLine`:

```swift
var course: Int
```

And subtitle:

```swift
var parts: [String] = [PosCourse.label(course)]
```

- [ ] **Step 2: Update call sites**

- `LineConfigureSheet`: `initialCourse: Int = PosCourse.main`, `@State private var course = PosCourse.main`, `ForEach(PosCourse.uiCourses, id: \.self)`.
- `PosDesign.courseColor(_ course: Int)` — switch on 1/2/3/default.
- `PosRuntime`: decode `PosCourse.parse(line.course)`; send `course` as Int in payloads; replace `.other` / `.main` with `PosCourse.default` / `.main`.
- `TableSessionView`: `fireCourse(sessionId:course: 2)` (not `"main"`).
- `KdsView`: parse Int / `PosCourse.label`.
- `PosCloudKdsDevice.courses: [Int]` — custom decode: accept `[Int]` or `[String]` via parse.
- `PosHubState` course filter: `Set<Int>`.

- [ ] **Step 3: Unit tests**

Create `PosCourseTests.swift`:

```swift
import XCTest
@testable import GwadaPOS

final class PosCourseTests: XCTestCase {
    func testParseLegacy() {
        XCTAssertEqual(PosCourse.parse("starter"), 1)
        XCTAssertEqual(PosCourse.parse("main"), 2)
        XCTAssertEqual(PosCourse.parse("side"), 2)
        XCTAssertEqual(PosCourse.parse("3"), 3)
        XCTAssertEqual(PosCourse.parse(nil), 2)
    }

    func testLabels() {
        XCTAssertEqual(PosCourse.label(1), "Vorspeise")
        XCTAssertEqual(PosCourse.label(4), "Gang 4")
    }
}
```

(If module name differs, match existing tests’ `@testable import`.)

- [ ] **Step 4: Build + test**

Run Swift build and `PosCourseTests`. Fix compile errors until green.

- [ ] **Step 5: Commit**

```bash
git add apps/pos
git commit -m "$(cat <<'EOF'
feat(pos): switch Swift cart and KDS courses to Int

Keeps existing list UI; chips limited to courses 1–3.
EOF
)"
```

---

### Task 6: Swift — Beilagen-Decode + Side-Pool + Options-Helper

**Files:**
- Modify: `apps/pos/Sources/Cloud/PosBootstrapModels.swift`
- Create: `apps/pos/Sources/Menu/PosMenuSidePool.swift`
- Create: `apps/pos/Tests/GwadaPOSTests/PosCloudMenuSidesCodableTests.swift`
- Create: `apps/pos/Tests/GwadaPOSTests/PosMenuSidePoolTests.swift`

**Interfaces:**
- Produces:
  - `PosCloudMenuItemSideConfig { required: Bool; max: Int; includedCount: Int }`
  - `PosCloudMenuItem.sidePriceCents: Int?`, `.sides: PosCloudMenuItemSideConfig?`
  - `PosMenuSidePool.sideItems(from catalog: PosCloudMenuCatalog) -> [PosCloudMenuItem]`
  - `PosCloudMenuOptionGroup.isSelectionCountValid(_ count: Int) -> Bool`

- [ ] **Step 1: Extend bootstrap models**

Add:

```swift
struct PosCloudMenuItemSideConfig: Codable, Equatable, Sendable {
    var required: Bool
    var max: Int
    var includedCount: Int
}
```

On `PosCloudMenuItem`, add optional fields with decode defaults `nil` (backward compatible). Update `CodingKeys` + `init(from:)` / `encode`.

- [ ] **Step 2: Side pool + option validity**

Create `apps/pos/Sources/Menu/PosMenuSidePool.swift`:

```swift
import Foundation

enum PosMenuSidePool {
    static let sideCategoryName = "Beilagen"

    static func sideItems(from catalog: PosCloudMenuCatalog) -> [PosCloudMenuItem] {
        let ids = Set(
            catalog.categories
                .filter { $0.name.compare(sideCategoryName, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame }
                .map(\.id)
        )
        return catalog.items.filter { ids.contains($0.categoryId) && $0.active }
    }
}

extension PosCloudMenuOptionGroup {
    func isSelectionCountValid(_ count: Int) -> Bool {
        if count < minSelect { return false }
        if let maxSelect, count > maxSelect { return false }
        return true
    }

    var effectiveMaxSelect: Int? { maxSelect }
}
```

- [ ] **Step 3: Tests**

Codable round-trip JSON with `sidePriceCents` + `sides`.  
Side-pool: catalog with category `"Beilagen"` returns only those items.  
Option group: `minSelect=1, maxSelect=2` → count 0 false, 1–2 true, 3 false.

- [ ] **Step 4: Build + test + commit**

```bash
git add apps/pos/Sources/Cloud/PosBootstrapModels.swift apps/pos/Sources/Menu apps/pos/Tests
git commit -m "$(cat <<'EOF'
feat(pos): decode menu sides and expose side-pool helper

Options min/max validity ready for ModifierSheet in phase 2.
EOF
)"
```

---

### Task 7: `PosDesign` Tokens + System Text-Styles

**Files:**
- Modify: `apps/pos/Sources/UI/PosDesign.swift`

**Interfaces:**
- Produces color tokens: `bg`, `surface`, `surface2`, `line`, `ink`, `muted`, `brass`, `paper`, `green`; status dots; `fontDisplay`, `fontBody`, `fontMonoTabular`; `courseColor(Int)` already Int from Task 5.

- [ ] **Step 1: Add warm light palette + text styles**

Append to `PosDesign` (exact hex may match product mock; if mock unavailable use):

```swift
// MARK: - Foundation tokens (Phase 1)
static let bg = Color(red: 0.96, green: 0.95, blue: 0.93)      // warm gray
static let surface = Color(red: 1.0, green: 0.99, blue: 0.97)
static let surface2 = Color(red: 0.94, green: 0.93, blue: 0.90)
static let line = Color(red: 0.85, green: 0.83, blue: 0.79)
static let ink = Color(red: 0.12, green: 0.11, blue: 0.10)
static let muted = Color(red: 0.45, green: 0.43, blue: 0.40)
static let brass = Color(red: 0.72, green: 0.58, blue: 0.32)
static let paper = Color(red: 0.98, green: 0.96, blue: 0.90)
static let green = Color(red: 0.22, green: 0.55, blue: 0.35)
static let statusAmber = Color(red: 0.85, green: 0.55, blue: 0.15) // Phase 4b prep

static var fontDisplay: Font { .system(.largeTitle, design: .rounded).weight(.bold) }
static var fontBody: Font { .body }
static var fontMonoTabular: Font { .body.monospaced().monospacedDigit() }
```

Keep existing statusFree/Occupied/…; optionally map `statusPaid` to `green`.

Ensure `courseColor(_ course: Int)`:

```swift
static func courseColor(_ course: Int) -> Color {
    switch course {
    case 1: return .orange
    case 2: return brass
    case 3: return .pink
    default: return muted
    }
}
```

- [ ] **Step 2: Build** (compile only; no wholesale restyle of all screens in Phase 1)

- [ ] **Step 3: Commit**

```bash
git add apps/pos/Sources/UI/PosDesign.swift
git commit -m "$(cat <<'EOF'
feat(pos): add foundation color tokens and system text styles

Custom fonts deferred; tokens ready for order UI and paper receipt.
EOF
)"
```

---

### Task 8: `PaperReceiptView` (Sägezahn-Shell)

**Files:**
- Create: `apps/pos/Sources/UI/PaperReceiptView.swift`

**Interfaces:**
- Produces: `PaperReceiptView<Content: View>` with sawtooth top/bottom, `PosDesign.paper` background, content `ViewBuilder`. No cart dependency.

- [ ] **Step 1: Implement shape + view**

```swift
import SwiftUI

struct SawtoothEdge: Shape {
    var toothWidth: CGFloat = 10
    var toothHeight: CGFloat = 6

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: 0, y: toothHeight))
        var x: CGFloat = 0
        var up = true
        while x < rect.width {
            let next = min(x + toothWidth, rect.width)
            let y: CGFloat = up ? 0 : toothHeight
            path.addLine(to: CGPoint(x: next, y: y))
            x = next
            up.toggle()
        }
        path.addLine(to: CGPoint(x: rect.width, y: rect.height))
        path.addLine(to: CGPoint(x: 0, y: rect.height))
        path.closeSubpath()
        return path
    }
}

struct PaperReceiptView<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(spacing: 0) {
            SawtoothEdge()
                .fill(PosDesign.paper)
                .frame(height: 8)
                .rotationEffect(.degrees(180))
            content()
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(PosDesign.paper)
            SawtoothEdge()
                .fill(PosDesign.paper)
                .frame(height: 8)
        }
        .foregroundStyle(PosDesign.ink)
        .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
    }
}

#if DEBUG
#Preview {
    ZStack {
        PosDesign.bg.ignoresSafeArea()
        PaperReceiptView {
            Text("Demo-Bon").font(PosDesign.fontDisplay)
            Text("Tisch 12 · Gang 2")
                .font(PosDesign.fontBody)
                .foregroundStyle(PosDesign.muted)
            Text("12,50 €").font(PosDesign.fontMonoTabular)
        }
        .padding()
    }
}
#endif
```

Refine sawtooth visually if Preview looks wrong (mirror bottom edge); keep API stable.

- [ ] **Step 2: Build + open Preview in Xcode (manual)**

- [ ] **Step 3: Commit**

```bash
git add apps/pos/Sources/UI/PaperReceiptView.swift
git commit -m "$(cat <<'EOF'
feat(pos): add reusable paper receipt shell with sawtooth edges

Placeholder content only; phase 3 fills cart/fire grouping.
EOF
)"
```

---

### Task 9: Abschluss-Verifikation

**Files:** none new (checklist)

- [ ] **Step 1: Dev-DB** — `pos_order_lines.course` is integer; enum gone (re-check Task 1).
- [ ] **Step 2: Domain** — `pnpm --filter @gwada/pos-domain test` PASS.
- [ ] **Step 3: Swift** — build + unit tests PASS.
- [ ] **Step 4: Smoke** — open existing TableSession / LineConfigureSheet: Gang-Chips 1–3; add line; fire course 2 still works against Dev (Nest or Hub path used in your setup).
- [ ] **Step 5: Spec acceptance** — tick criteria 1–5 in the design spec mentally; note any leftover in a short PR/summary comment.
- [ ] **Step 6: Optional meta-commit** if only docs left:

```bash
git add docs/superpowers/specs/2026-07-29-pos-order-ui-foundation-design.md docs/superpowers/plans/2026-07-29-pos-order-ui-foundation.md
git commit -m "$(cat <<'EOF'
docs(pos): add phase-1 order UI foundation spec and plan
EOF
)"
```

---

## Spec coverage (self-check)

| Spec item | Task |
|-----------|------|
| 1a Tokens + status + courseColor Int | 5 (color sig) + 7 |
| 1b System text styles | 7 |
| 1c Paper Bon shell | 8 |
| 1d Int migration + API + Swift minimal UI | 1–3, 5 |
| 1e Bootstrap sides + Swift + side pool | 4, 6 |
| 1f Options min/max helper | 6 |
| Dev-DB only | 1 |
| No Phase 2–4 UI | Constraints |

## Parallelism note for subagents

Safe parallel after Task 1+2 land: **Task 3 ‖ Task 4 ‖ Task 7** (different trees). Task 5 needs Task 1 conceptually for runtime but can compile against Int models first. Task 6 after Task 4 shape is known. Task 8 after Task 7 tokens.
