import assert from "node:assert/strict";
import { test } from "node:test";

import { liveActivityFromNotificationEvent } from "@/lib/live-activity/live-activity-from-notification-event";
import { formatPurchaseOrderCompletionSubtitle } from "@/lib/live-activity/purchase-order-completion-feed";

test("Untertitel lässt Null-Eimer weg und bleibt bei voller Lieferung kurz", () => {
  assert.equal(
    formatPurchaseOrderCompletionSubtitle({
      orderedCount: 50,
      deliveredCount: 50,
      shortCount: 0,
      missingCount: 0,
    }),
    "50/50 geliefert",
  );
  assert.equal(
    formatPurchaseOrderCompletionSubtitle({
      orderedCount: 50,
      deliveredCount: 43,
      shortCount: 5,
      missingCount: 2,
    }),
    "43/50 geliefert · 5/50 Fehlmenge · 2/50 nicht geliefert",
  );
  assert.equal(
    formatPurchaseOrderCompletionSubtitle({
      orderedCount: 50,
      deliveredCount: 48,
      shortCount: 0,
      missingCount: 2,
    }),
    "48/50 geliefert · 2/50 nicht geliefert",
  );
  assert.equal(
    formatPurchaseOrderCompletionSubtitle({
      orderedCount: 7,
      deliveredCount: 0,
      shortCount: 0,
      missingCount: 7,
    }),
    "7/7 nicht geliefert",
  );
});

test("Abschluss-Zeile bündelt die Bestellung und listet nur Ausnahmen", () => {
  const item = liveActivityFromNotificationEvent({
    eventId: "evt-close",
    module: "inventory_po_activity",
    payload: {
      kind: "order_completed",
      orderId: "order-1",
      staffName: "Lukas Dreyer",
      orderedCount: 50,
      deliveredCount: 43,
      shortCount: 5,
      missingCount: 2,
      exceptions: [
        {
          ingredientName: "Tomaten",
          status: "partial",
          orderedQuantity: 10,
          deliveredQuantity: 7,
          unitLabel: "kg",
        },
        {
          ingredientName: "Salz",
          status: "delivered",
          orderedQuantity: 2,
          deliveredQuantity: 2,
          unitLabel: "kg",
        },
        {
          ingredientName: "Pfeffer",
          status: "not_delivered",
          orderedQuantity: 1,
          deliveredQuantity: 0,
          unitLabel: "kg",
        },
      ],
    },
  });

  assert.equal(item.title, "Bestellung abgeschlossen");
  assert.equal(
    item.description,
    "43/50 geliefert · 5/50 Fehlmenge · 2/50 nicht geliefert",
  );
  assert.equal(item.href, "/dashboard/inventory/purchase-orders?order=order-1");
  assert.deepEqual(
    item.purchaseOrderCompletion?.exceptions.map((line) => line.ingredientName),
    ["Tomaten", "Pfeffer"],
  );
});

test("Einzelne Lieferung und Bestand außerhalb der Bestellung bleiben eigene Zeilen", () => {
  const delivered = liveActivityFromNotificationEvent({
    module: "inventory_po_activity",
    payload: {
      kind: "marked_delivered",
      ingredientName: "Mehl",
      quantity: 5,
      unitLabel: "kg",
      staffName: "Anna",
    },
  });
  assert.equal(delivered.title, "Anna · Lieferung erfasst");
  assert.equal(delivered.purchaseOrderCompletion, undefined);

  const stock = liveActivityFromNotificationEvent({
    module: "inventory_stock_activity",
    payload: {
      kind: "manual_stock",
      ingredientName: "Zucker",
      fromQuantity: 1,
      toQuantity: 4,
      unitLabel: "kg",
      staffName: "Anna",
    },
  });
  assert.equal(stock.title, "Anna · Bestand geändert");
  assert.match(stock.description ?? "", /„Zucker“ · 1 .+ → 4 /);
  assert.equal(stock.purchaseOrderCompletion, undefined);
});
