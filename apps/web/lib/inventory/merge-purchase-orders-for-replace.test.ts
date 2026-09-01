import assert from "node:assert/strict";
import { test } from "node:test";

import { mergePurchaseOrdersForReplace } from "./merge-purchase-orders-for-replace.ts";
import type { PurchaseOrder } from "@/lib/types/purchase-order";

function order(
  partial: Partial<PurchaseOrder> & Pick<PurchaseOrder, "id" | "status">,
): PurchaseOrder {
  return {
    supplierId: "sup-1",
    supplierName: "Lieferant",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "Test",
    deliveryDate: null,
    lines: [],
    log: [],
    ...partial,
  };
}

test("preserves closed DB orders missing from stale client snapshot", () => {
  const closed = order({
    id: "closed-1",
    status: "closed",
    lines: [
      {
        id: "line-1",
        ingredientId: "ing-1",
        ingredientName: "Tomaten",
        quantity: 5,
        unitId: "kg",
        unitLabel: "kg",
      },
    ],
    log: [
      {
        id: "log-1",
        at: "2026-01-02T00:00:00.000Z",
        kind: "status_change",
        fromStatus: "ordered",
        toStatus: "closed",
        ingredientId: "",
        ingredientName: "",
        unitId: "",
        unitLabel: "",
        userFirstName: "",
        userLastName: "",
      },
    ],
  });
  const open = order({
    id: "open-1",
    status: "open",
    lines: [
      {
        id: "line-2",
        ingredientId: "ing-2",
        ingredientName: "Zwiebeln",
        quantity: 3,
        unitId: "kg",
        unitLabel: "kg",
      },
    ],
  });

  const merged = mergePurchaseOrdersForReplace([closed], [open]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((o) => o.id === "closed-1")?.status, "closed");
  assert.equal(merged.find((o) => o.id === "open-1")?.status, "open");
});

test("prevents status regression when client log is stale", () => {
  const dbOrder = order({
    id: "o-1",
    status: "closed",
    log: [
      {
        id: "log-1",
        at: "2026-01-01T00:00:00.000Z",
        kind: "status_change",
        fromStatus: "ordered",
        toStatus: "closed",
        ingredientId: "",
        ingredientName: "",
        unitId: "",
        unitLabel: "",
        userFirstName: "",
        userLastName: "",
      },
    ],
  });
  const staleClient = order({
    id: "o-1",
    status: "open",
    log: [],
  });

  const merged = mergePurchaseOrdersForReplace([dbOrder], [staleClient]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.status, "closed");
});

test("applies client reopen when protocol is newer than DB", () => {
  const dbOrder = order({
    id: "o-1",
    status: "closed",
    log: [
      {
        id: "log-1",
        at: "2026-01-01T00:00:00.000Z",
        kind: "status_change",
        fromStatus: "ordered",
        toStatus: "closed",
        ingredientId: "",
        ingredientName: "",
        unitId: "",
        unitLabel: "",
        userFirstName: "",
        userLastName: "",
      },
    ],
  });
  const reopened = order({
    id: "o-1",
    status: "ordered",
    log: [
      {
        id: "log-1",
        at: "2026-01-01T00:00:00.000Z",
        kind: "status_change",
        fromStatus: "ordered",
        toStatus: "closed",
        ingredientId: "",
        ingredientName: "",
        unitId: "",
        unitLabel: "",
        userFirstName: "",
        userLastName: "",
      },
      {
        id: "log-2",
        at: "2026-01-02T00:00:00.000Z",
        kind: "status_change",
        fromStatus: "closed",
        toStatus: "ordered",
        ingredientId: "",
        ingredientName: "",
        unitId: "",
        unitLabel: "",
        userFirstName: "",
        userLastName: "",
      },
    ],
  });

  const merged = mergePurchaseOrdersForReplace([dbOrder], [reopened]);
  assert.equal(merged[0]?.status, "ordered");
});

test("drops empty open orders omitted by client prune", () => {
  const emptyOpen = order({ id: "empty-open", status: "open", lines: [] });
  const merged = mergePurchaseOrdersForReplace([emptyOpen], []);
  assert.equal(merged.length, 0);
});

test("adds brand-new client orders not yet in DB", () => {
  const fresh = order({
    id: "new-open",
    status: "open",
    lines: [
      {
        id: "line-1",
        ingredientId: "ing-1",
        ingredientName: "Salz",
        quantity: 1,
        unitId: "kg",
        unitLabel: "kg",
      },
    ],
  });

  const merged = mergePurchaseOrdersForReplace([], [fresh]);
  assert.deepEqual(merged, [fresh]);
});
