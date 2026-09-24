import assert from "node:assert/strict";
import { test } from "node:test";

import { computeDashboardInventorySummary } from "./compute-dashboard-inventory-summary.ts";
import type { PurchaseOrder } from "../types/purchase-order.ts";

function order(
  id: string,
  status: PurchaseOrder["status"],
): PurchaseOrder {
  return {
    id,
    supplierId: "sup",
    supplierName: "Lieferant",
    status,
    createdAt: "2026-09-24T08:00:00.000Z",
    createdBy: "Test",
    deliveryDate: null,
    lines: [],
    log: [],
  };
}

test("bestellt zählt nicht als offen", () => {
  const summary = computeDashboardInventorySummary(
    [],
    [order("a", "ordered"), order("b", "open"), order("c", "closed")],
    "2026-09-24",
  );
  assert.equal(summary.ordersOrdered, 1);
  assert.equal(summary.ordersOpen, 1);
  assert.equal(summary.openOrders, 2);
});
