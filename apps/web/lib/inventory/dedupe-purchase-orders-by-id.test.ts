import assert from "node:assert/strict";
import { test } from "node:test";

import { dedupePurchaseOrdersById } from "./dedupe-purchase-orders-by-id.ts";
import type { PurchaseOrder } from "../types/purchase-order.ts";

function order(id: string): PurchaseOrder {
  return {
    id,
    supplierId: "s1",
    supplierName: "S",
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "",
    deliveryDate: null,
    lines: [],
    log: [],
  };
}

test("dedupePurchaseOrdersById keeps last duplicate id", () => {
  const first = order("dup");
  first.lines = [
    {
      id: "l1",
      ingredientId: "i1",
      ingredientName: "A",
      quantity: 1,
      unitId: "u",
      unitLabel: "u",
    },
  ];
  const second = order("dup");
  second.lines = [
    {
      id: "l2",
      ingredientId: "i2",
      ingredientName: "B",
      quantity: 2,
      unitId: "u",
      unitLabel: "u",
    },
  ];
  const deduped = dedupePurchaseOrdersById([first, second, order("other")]);
  assert.equal(deduped.length, 2);
  assert.equal(deduped.find((o) => o.id === "dup")?.lines[0]?.ingredientId, "i2");
});
