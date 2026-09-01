import assert from "node:assert/strict";
import { test } from "node:test";

import { computeDashboardInventorySummary } from "./compute-dashboard-inventory-summary.ts";
import type { Ingredient } from "../types/inventory.ts";

function ingredient(
  patch: Partial<Ingredient> & Pick<Ingredient, "id" | "name">,
): Ingredient {
  return {
    unit: "g",
    currentStock: 0,
    supplierId: "s",
    categoryId: "c",
    productionSiteId: "p",
    brandId: "b",
    stockLog: [],
    ...patch,
  };
}

test("Heute emptyStock zählt nur aktive Zutaten mit Bestand ≤ 0", () => {
  const summary = computeDashboardInventorySummary(
    [
      ingredient({ id: "a", name: "Mehl", currentStock: 0, active: true }),
      ingredient({ id: "b", name: "Alt", currentStock: 0, active: false }),
      ingredient({ id: "c", name: "Zucker", currentStock: 2, active: true }),
      ingredient({ id: "d", name: "ohne Flag", currentStock: 0 }),
    ],
    [],
  );
  assert.equal(summary.emptyStock, 2);
  assert.equal(summary.ingredientsActive, 3);
});
