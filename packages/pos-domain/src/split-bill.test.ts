import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyPersonPayment,
  applyRestPayment,
  applySharePayment,
  canPayPerson,
  computeShareCents,
  createSplitBillState,
  isSplitFullyPaid,
} from "./split-bill.ts";

const here = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(
  readFileSync(join(here, "../fixtures/split-bill.golden.json"), "utf8"),
) as {
  cases: Array<{
    id: string;
    openCents: number;
    evenN?: number;
    steps: Array<
      | { op: "share" }
      | { op: "rest" }
      | { op: "person"; amountCents: number }
      | { op: "expect"; openCents: number; settledCents: number; mode: string; evenN: number }
      | { op: "expectError"; on: string; error: string }
    >;
  }>;
};

test("computeShareCents rounds up to 10ct and last share is exact", () => {
  assert.equal(computeShareCents(1000, 3), 340);
  assert.equal(computeShareCents(1000, 1), 1000);
  assert.equal(computeShareCents(0, 2), 0);
});

test("person pay locked after first share", () => {
  let s = createSplitBillState(5000, 2);
  assert.equal(canPayPerson(s), true);
  const share = applySharePayment(s);
  assert.equal(share.ok, true);
  if (!share.ok) return;
  s = share.state;
  assert.equal(s.mode, "amount");
  assert.equal(canPayPerson(s), false);
  const person = applyPersonPayment(s, 100);
  assert.equal(person.ok, false);
  if (person.ok) return;
  assert.equal(person.error, "person_locked_after_share");
});

test("share then rest pays exact total", () => {
  const open = 4550;
  let s = createSplitBillState(open, 2);
  const a = applySharePayment(s);
  assert.ok(a.ok);
  if (!a.ok) return;
  s = a.state;
  const b = applyRestPayment(s);
  assert.ok(b.ok);
  if (!b.ok) return;
  assert.equal(a.chargedCents + b.chargedCents, open);
  assert.equal(isSplitFullyPaid(b.state), true);
});

test("golden fixtures", () => {
  for (const c of golden.cases) {
    let state = createSplitBillState(c.openCents, c.evenN ?? 2);
    for (const step of c.steps) {
      if (step.op === "expect") {
        assert.equal(state.openCents, step.openCents, `${c.id} open`);
        assert.equal(state.settledCents, step.settledCents, `${c.id} settled`);
        assert.equal(state.mode, step.mode, `${c.id} mode`);
        assert.equal(state.evenN, step.evenN, `${c.id} evenN`);
        continue;
      }
      if (step.op === "expectError") {
        const r =
          step.on === "person"
            ? applyPersonPayment(state, 100)
            : step.on === "share"
              ? applySharePayment(state)
              : applyRestPayment(state);
        assert.equal(r.ok, false, `${c.id} expected error`);
        if (!r.ok) assert.equal(r.error, step.error, `${c.id} error code`);
        continue;
      }
      if (step.op === "share") {
        const r = applySharePayment(state);
        assert.equal(r.ok, true, `${c.id} share ok`);
        if (r.ok) state = r.state;
      } else if (step.op === "rest") {
        const r = applyRestPayment(state);
        assert.equal(r.ok, true, `${c.id} rest ok`);
        if (r.ok) state = r.state;
      } else if (step.op === "person") {
        const r = applyPersonPayment(state, step.amountCents);
        assert.equal(r.ok, true, `${c.id} person ok`);
        if (r.ok) state = r.state;
      }
    }
  }
});
