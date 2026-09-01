import assert from "node:assert/strict";
import { test } from "node:test";

import { isIngredientActive, isIngredientLowStock } from "./low-stock.ts";

test("isIngredientActive: undefined gilt als aktiv", () => {
  assert.equal(isIngredientActive({}), true);
  assert.equal(isIngredientActive({ active: true }), true);
  assert.equal(isIngredientActive({ active: false }), false);
});

test("Heute empty-stock zählt inaktive Zutaten nicht", () => {
  const ingredients = [
    { currentStock: 0, active: true },
    { currentStock: 0, active: false },
    { currentStock: 0 },
    { currentStock: 2, active: true },
  ];
  const emptyStock = ingredients
    .filter(isIngredientActive)
    .filter((i) => i.currentStock <= 0).length;
  assert.equal(emptyStock, 2);
});

test("isIngredientLowStock ignoriert inaktive Zutaten", () => {
  assert.equal(
    isIngredientLowStock({
      currentStock: 0,
      lowStockThreshold: 0,
      active: false,
    }),
    false,
  );
  assert.equal(
    isIngredientLowStock({
      currentStock: 0,
      lowStockThreshold: 0,
      active: true,
    }),
    true,
  );
});
