import assert from "node:assert/strict";
import { test } from "node:test";

import { purchaseOrderCloseProgressPercent } from "./purchase-order-close-progress.ts";

test("purchaseOrderCloseProgressPercent: 0 von n ist 0%", () => {
  assert.equal(purchaseOrderCloseProgressPercent({ done: 0, total: 40 }), 0);
});

test("purchaseOrderCloseProgressPercent: anteilig gerundet", () => {
  assert.equal(purchaseOrderCloseProgressPercent({ done: 10, total: 40 }), 25);
  assert.equal(purchaseOrderCloseProgressPercent({ done: 1, total: 3 }), 33);
});

test("purchaseOrderCloseProgressPercent: fertig ist 100%", () => {
  assert.equal(purchaseOrderCloseProgressPercent({ done: 40, total: 40 }), 100);
  assert.equal(purchaseOrderCloseProgressPercent({ done: 0, total: 0 }), 100);
});
