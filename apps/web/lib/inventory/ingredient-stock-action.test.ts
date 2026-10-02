import assert from "node:assert/strict";
import { test } from "node:test";

import { ingredientStockActionColumn } from "@/lib/types/ingredient-stock-log";
import type { IngredientStockLogEntry } from "@/lib/types/ingredient-stock-log";

function deliveryEntry(
  kind: "stock_from_delivery" | "stock_delivery_reverted",
  supplierName: string,
): IngredientStockLogEntry {
  return {
    id: "log-1",
    at: "2026-10-02T10:00:00.000Z",
    userFirstName: "Anna",
    userLastName: "Keller",
    kind,
    fromQuantity: 1,
    toQuantity: 4,
    unitId: "kg",
    unitLabel: "kg",
    orderId: "order-1",
    supplierName,
  };
}

test("Lieferbuchung nennt den Lieferanten als Bestellung", () => {
  assert.equal(
    ingredientStockActionColumn(deliveryEntry("stock_from_delivery", "Metro")),
    "Geliefert markiert · aus Bestellung Metro",
  );
  assert.equal(
    ingredientStockActionColumn(deliveryEntry("stock_delivery_reverted", "Metro")),
    "Geliefert rückgängig · aus Bestellung Metro",
  );
});

test("Ohne Lieferantennamen bleibt die Aktion ohne leere Bestellung", () => {
  assert.equal(
    ingredientStockActionColumn(deliveryEntry("stock_from_delivery", "  ")),
    "Geliefert markiert",
  );
});

test("Manuelle Bestandskorrektur nennt keine Bestellung", () => {
  const manual: IngredientStockLogEntry = {
    id: "log-2",
    at: "2026-10-02T10:00:00.000Z",
    userFirstName: "Anna",
    userLastName: "Keller",
    kind: "manual_stock",
    fromQuantity: 2,
    toQuantity: 5,
    unitId: "kg",
    unitLabel: "kg",
  };
  assert.equal(ingredientStockActionColumn(manual), "Menge geändert");
});
