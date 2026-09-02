import assert from "node:assert/strict";
import { test } from "node:test";

import { mergePurchaseOrdersForReplace } from "./merge-purchase-orders-for-replace.ts";
import { reconcilePurchaseOrderLinesFromLog } from "./reconcile-purchase-order-lines-from-log.ts";
import type { PurchaseOrder } from "../types/purchase-order";

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

test("newer statusUpdatedAt wins over longer stale client log", () => {
  const dbOrder = order({
    id: "o-1",
    status: "ordered",
    statusUpdatedAt: "2026-09-02T21:00:00.000Z",
    log: [
      {
        id: "log-status",
        at: "2026-09-02T21:00:00.000Z",
        kind: "status_change",
        fromStatus: "open",
        toStatus: "ordered",
        ingredientId: "",
        ingredientName: "",
        unitId: "",
        unitLabel: "",
        userFirstName: "A",
        userLastName: "B",
      },
    ],
  });
  const staleClient = order({
    id: "o-1",
    status: "open",
    statusUpdatedAt: "2026-09-02T20:00:00.000Z",
    log: [
      {
        id: "log-add-1",
        at: "2026-09-02T20:00:00.000Z",
        kind: "add_to_order",
        ingredientId: "ing-1",
        ingredientName: "X",
        quantity: 1,
        unitId: "stk",
        unitLabel: "Stk",
        userFirstName: "C",
        userLastName: "D",
      },
      {
        id: "log-add-2",
        at: "2026-09-02T20:01:00.000Z",
        kind: "add_to_order",
        ingredientId: "ing-2",
        ingredientName: "Y",
        quantity: 2,
        unitId: "stk",
        unitLabel: "Stk",
        userFirstName: "C",
        userLastName: "D",
      },
    ],
  });

  const merged = mergePurchaseOrdersForReplace([dbOrder], [staleClient]);
  assert.equal(merged[0]?.status, "ordered");
  assert.equal(merged[0]?.statusUpdatedAt, "2026-09-02T21:00:00.000Z");
  assert.equal(merged[0]?.log.length, 3);
});

test("keeps DB lines when client has equal log length but fewer lines", () => {
  const sharedLog = [
    {
      id: "log-add-1",
      at: "2026-09-01T10:00:00.000Z",
      kind: "add_to_order" as const,
      ingredientId: "ing-a",
      ingredientName: "Produkt A",
      quantity: 2,
      unitId: "stk",
      unitLabel: "Stk",
      userFirstName: "Petra",
      userLastName: "Test",
    },
    {
      id: "log-add-2",
      at: "2026-09-01T10:05:00.000Z",
      kind: "add_to_order" as const,
      ingredientId: "ing-b",
      ingredientName: "Produkt B",
      quantity: 4,
      unitId: "kg",
      unitLabel: "kg",
      userFirstName: "Petra",
      userLastName: "Test",
    },
  ];

  const dbOrder = order({
    id: "o-1",
    status: "open",
    supplierName: "SB Union",
    lines: [
      {
        id: "line-a",
        ingredientId: "ing-a",
        ingredientName: "Produkt A",
        quantity: 2,
        unitId: "stk",
        unitLabel: "Stk",
      },
      {
        id: "line-b",
        ingredientId: "ing-b",
        ingredientName: "Produkt B",
        quantity: 4,
        unitId: "kg",
        unitLabel: "kg",
      },
    ],
    log: sharedLog,
  });

  const staleClient = order({
    id: "o-1",
    status: "open",
    supplierName: "SB Union",
    lines: [],
    log: sharedLog,
  });

  const merged = mergePurchaseOrdersForReplace([dbOrder], [staleClient]);
  assert.equal(merged[0]?.lines.length, 2);
  assert.equal(
    merged[0]?.lines.find((l) => l.ingredientId === "ing-b")?.quantity,
    4,
  );
});

test("reconcile rebuilds all open-order lines from protocol", () => {
  const broken = order({
    id: "o-1",
    status: "open",
    lines: [
      {
        id: "line-1",
        ingredientId: "ing-1",
        ingredientName: "Milch",
        quantity: 2,
        unitId: "l",
        unitLabel: "l",
      },
    ],
    log: [
      {
        id: "log-1",
        at: "2026-09-01T08:00:00.000Z",
        kind: "add_to_order",
        ingredientId: "ing-1",
        ingredientName: "Milch",
        quantity: 2,
        unitId: "l",
        unitLabel: "l",
        userFirstName: "",
        userLastName: "",
      },
      {
        id: "log-2",
        at: "2026-09-01T09:00:00.000Z",
        kind: "add_to_order",
        ingredientId: "ing-1",
        ingredientName: "Milch",
        quantity: 4,
        unitId: "l",
        unitLabel: "l",
        userFirstName: "",
        userLastName: "",
      },
      {
        id: "log-3",
        at: "2026-09-01T10:00:00.000Z",
        kind: "add_to_order",
        ingredientId: "ing-2",
        ingredientName: "Butter",
        quantity: 3,
        unitId: "kg",
        unitLabel: "kg",
        userFirstName: "",
        userLastName: "",
      },
    ],
  });

  const healed = reconcilePurchaseOrderLinesFromLog(broken);
  assert.equal(healed.lines.length, 2);
  assert.equal(healed.lines.find((l) => l.ingredientId === "ing-1")?.quantity, 6);
  assert.equal(healed.lines.find((l) => l.ingredientId === "ing-2")?.quantity, 3);
});

test("merge unions protocol entries from db and client", () => {
  const dbOrder = order({
    id: "o-1",
    status: "open",
    lines: [],
    log: [
      {
        id: "log-a",
        at: "2026-09-01T08:00:00.000Z",
        kind: "add_to_order",
        ingredientId: "ing-a",
        ingredientName: "A",
        quantity: 1,
        unitId: "x",
        unitLabel: "x",
        userFirstName: "",
        userLastName: "",
      },
    ],
  });
  const clientOrder = order({
    id: "o-1",
    status: "open",
    lines: [],
    log: [
      {
        id: "log-b",
        at: "2026-09-01T09:00:00.000Z",
        kind: "add_to_order",
        ingredientId: "ing-b",
        ingredientName: "B",
        quantity: 2,
        unitId: "x",
        unitLabel: "x",
        userFirstName: "",
        userLastName: "",
      },
    ],
  });

  const merged = mergePurchaseOrdersForReplace([dbOrder], [clientOrder]);
  assert.equal(merged[0]?.log.length, 2);
  assert.equal(merged[0]?.lines.length, 2);
});

test("reconcile adds missing lines from add_to_order protocol entries", () => {
  const broken = order({
    id: "o-1",
    status: "open",
    lines: [],
    log: [
      {
        id: "log-1",
        at: "2026-09-01T08:00:00.000Z",
        kind: "add_to_order",
        ingredientId: "ing-1",
        ingredientName: "Milch",
        quantity: 6,
        unitId: "l",
        unitLabel: "l",
        userFirstName: "",
        userLastName: "",
      },
      {
        id: "log-2",
        at: "2026-09-01T09:00:00.000Z",
        kind: "add_to_order",
        ingredientId: "ing-2",
        ingredientName: "Butter",
        quantity: 2,
        unitId: "kg",
        unitLabel: "kg",
        userFirstName: "",
        userLastName: "",
      },
    ],
  });

  const healed = reconcilePurchaseOrderLinesFromLog(broken);
  assert.equal(healed.lines.length, 2);
  assert.equal(healed.lines.find((l) => l.ingredientId === "ing-1")?.quantity, 6);
  assert.equal(healed.lines.find((l) => l.ingredientId === "ing-2")?.quantity, 2);
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
