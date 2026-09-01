import assert from "node:assert/strict";
import { test } from "node:test";

import { isIngredientActive, isIngredientLowStock, isEmptyStockVisibleInHeute } from "./low-stock.ts";

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

test("isEmptyStockVisibleInHeute: Snooze blendet leere Zutat aus", () => {
  assert.equal(
    isEmptyStockVisibleInHeute(
      { id: "a", currentStock: 0, active: true },
      new Set(["a"]),
    ),
    false,
  );
  assert.equal(
    isEmptyStockVisibleInHeute({ id: "a", currentStock: 0, active: true }),
    true,
  );
  assert.equal(
    isEmptyStockVisibleInHeute(
      { id: "a", currentStock: 2, active: true },
      new Set(["a"]),
    ),
    false,
  );
});

test("Heute empty-stock mit Snooze: nur nicht gesnoozte zählen", () => {
  const ingredients = [
    { id: "leer-1", currentStock: 0, active: true },
    { id: "leer-2", currentStock: 0, active: true },
    { id: "ok", currentStock: 5, active: true },
  ];
  const snoozed = new Set(["leer-1"]);
  const visible = ingredients.filter((i) =>
    isEmptyStockVisibleInHeute(i, snoozed),
  );
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.id, "leer-2");
});
