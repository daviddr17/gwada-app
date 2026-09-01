import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveLineDeliveryFromLog,
  derivePurchaseOrderStatusFromLog,
  findPurchaseOrdersNeedingRecovery,
} from "./recover-purchase-orders-from-log.ts";
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

test("derivePurchaseOrderStatusFromLog uses last status_change", () => {
  const log = [
    {
      id: "1",
      at: "2026-03-01T10:00:00.000Z",
      kind: "status_change" as const,
      fromStatus: "open" as const,
      toStatus: "ordered" as const,
      ingredientId: "",
      ingredientName: "",
      unitId: "",
      unitLabel: "",
      userFirstName: "",
      userLastName: "",
    },
    {
      id: "2",
      at: "2026-03-02T10:00:00.000Z",
      kind: "status_change" as const,
      fromStatus: "ordered" as const,
      toStatus: "closed" as const,
      ingredientId: "",
      ingredientName: "",
      unitId: "",
      unitLabel: "",
      userFirstName: "",
      userLastName: "",
    },
  ];
  assert.equal(derivePurchaseOrderStatusFromLog(log), "closed");
});

test("deriveLineDeliveryFromLog respects delivery_reverted", () => {
  const log = [
    {
      id: "1",
      at: "2026-03-01T10:00:00.000Z",
      kind: "marked_delivered" as const,
      lineId: "line-1",
      ingredientId: "ing-1",
      ingredientName: "Tomaten",
      quantity: 5,
      unitId: "kg",
      unitLabel: "kg",
      deliveryStatus: "delivered" as const,
      userFirstName: "",
      userLastName: "",
    },
    {
      id: "2",
      at: "2026-03-01T11:00:00.000Z",
      kind: "delivery_reverted" as const,
      lineId: "line-1",
      ingredientId: "ing-1",
      ingredientName: "Tomaten",
      quantity: 5,
      unitId: "kg",
      unitLabel: "kg",
      userFirstName: "",
      userLastName: "",
    },
  ];
  assert.equal(deriveLineDeliveryFromLog(log, "line-1"), null);
});

test("findPurchaseOrdersNeedingRecovery detects regressed closed order", () => {
  const regressed = order({
    id: "po-1",
    status: "open",
    supplierName: "Metro",
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
        at: "2026-03-01T09:00:00.000Z",
        kind: "status_change",
        fromStatus: "open",
        toStatus: "ordered",
        ingredientId: "",
        ingredientName: "",
        unitId: "",
        unitLabel: "",
        userFirstName: "Anna",
        userLastName: "Test",
      },
      {
        id: "log-2",
        at: "2026-03-02T10:00:00.000Z",
        kind: "marked_delivered",
        lineId: "line-1",
        ingredientId: "ing-1",
        ingredientName: "Tomaten",
        quantity: 5,
        unitId: "kg",
        unitLabel: "kg",
        deliveryStatus: "delivered",
        userFirstName: "Anna",
        userLastName: "Test",
      },
      {
        id: "log-3",
        at: "2026-03-02T11:00:00.000Z",
        kind: "status_change",
        fromStatus: "ordered",
        toStatus: "closed",
        ingredientId: "",
        ingredientName: "",
        unitId: "",
        unitLabel: "",
        userFirstName: "Anna",
        userLastName: "Test",
      },
    ],
  });

  const patches = findPurchaseOrdersNeedingRecovery([regressed]);
  assert.equal(patches.length, 1);
  assert.equal(patches[0]?.orderId, "po-1");
  assert.equal(patches[0]?.currentStatus, "open");
  assert.equal(patches[0]?.targetStatus, "closed");
  assert.equal(patches[0]?.linePatches.length, 1);
  assert.equal(patches[0]?.linePatches[0]?.target.deliveryStatus, "delivered");
});

test("findPurchaseOrdersNeedingRecovery is idempotent when already closed", () => {
  const closed = order({
    id: "po-2",
    status: "closed",
    lines: [
      {
        id: "line-1",
        ingredientId: "ing-1",
        ingredientName: "Tomaten",
        quantity: 5,
        unitId: "kg",
        unitLabel: "kg",
        deliveredAt: "2026-03-02T10:00:00.000Z",
        deliveryStatus: "delivered",
        deliveredQuantity: 5,
      },
    ],
    log: [
      {
        id: "log-1",
        at: "2026-03-02T11:00:00.000Z",
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
        at: "2026-03-02T10:00:00.000Z",
        kind: "marked_delivered",
        lineId: "line-1",
        ingredientId: "ing-1",
        ingredientName: "Tomaten",
        quantity: 5,
        unitId: "kg",
        unitLabel: "kg",
        deliveryStatus: "delivered",
        userFirstName: "",
        userLastName: "",
      },
    ],
  });

  assert.deepEqual(findPurchaseOrdersNeedingRecovery([closed]), []);
});
