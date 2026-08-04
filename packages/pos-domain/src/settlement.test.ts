import assert from "node:assert/strict";
import { test } from "node:test";

import {
  allocationAmountCents,
  deriveSessionSettlementState,
  sliceAmountCents,
} from "./settlement.ts";

test("sliceAmountCents sums to line total for odd cents", () => {
  const total = 101;
  const qty = 3;
  let paid = 0;
  let sum = 0;
  for (let i = 0; i < qty; i++) {
    const slice = sliceAmountCents(total, qty, paid, 1);
    sum += slice;
    paid += 1;
  }
  assert.equal(sum, total);
  assert.equal(sliceAmountCents(total, qty, 0, 1), 34);
  assert.equal(sliceAmountCents(total, qty, 1, 1), 33);
  assert.equal(sliceAmountCents(total, qty, 2, 1), 34);
});

test("open cents is original minus paid slices (no double round)", () => {
  const total = 101;
  const qty = 3;
  const afterFirst = deriveSessionSettlementState([
    { lineTotalCents: total, quantity: qty, paidQuantity: 1 },
  ]);
  assert.equal(afterFirst.paidCents, 34);
  assert.equal(afterFirst.openCents, 67);

  const afterSecond = deriveSessionSettlementState([
    { lineTotalCents: total, quantity: qty, paidQuantity: 2 },
  ]);
  assert.equal(afterSecond.paidCents, 67);
  assert.equal(afterSecond.openCents, 34);
  assert.equal(
    afterFirst.paidCents +
      sliceAmountCents(total, qty, 1, 1) +
      afterSecond.openCents,
    total,
  );
});

test("allocationAmountCents full line returns total", () => {
  assert.equal(allocationAmountCents(101, 3, 3), 101);
  assert.equal(allocationAmountCents(4000, 4, 1), 1000);
});
