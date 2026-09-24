import assert from "node:assert/strict";
import { test } from "node:test";

import { heutePurchaseOrderActions } from "./heute-purchase-order-action.ts";

test("bestellt ist blau und heißt bestellt, offen ist gelb", () => {
  assert.deepEqual(
    heutePurchaseOrderActions({ ordersOpen: 0, ordersOrdered: 1 }),
    [
      {
        id: "inventory-orders-ordered",
        title: "1 Bestellung bestellt",
        tone: "attention",
      },
    ],
  );
  assert.deepEqual(
    heutePurchaseOrderActions({ ordersOpen: 2, ordersOrdered: 0 }),
    [
      {
        id: "inventory-orders-open",
        title: "2 Bestellungen offen",
        tone: "warning",
      },
    ],
  );
});

test("ohne offene oder bestellte Bestellung keine Zeile", () => {
  assert.deepEqual(
    heutePurchaseOrderActions({ ordersOpen: 0, ordersOrdered: 0 }),
    [],
  );
});
