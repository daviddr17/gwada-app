import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveHeuteLiveSheetTarget } from "./dashboard-heute-live-sheet-target.ts";
import type { LiveActivityItem } from "../live-activity/live-activity-types.ts";

function item(
  partial: Partial<LiveActivityItem> & Pick<LiveActivityItem, "id" | "title" | "at">,
): LiveActivityItem {
  return {
    kind: "notification",
    ...partial,
  };
}

test("Reservierung pending öffnet unconfirmed-Sheet", () => {
  const target = resolveHeuteLiveSheetTarget(
    item({
      id: "1",
      title: "Neu",
      at: "2026-09-06T10:00:00.000Z",
      module: "reservations_pending",
    }),
  );
  assert.deepEqual(target, { type: "reservations", mode: "unconfirmed" });
});

test("Inventory-Module öffnen Inventory-Sheet", () => {
  const target = resolveHeuteLiveSheetTarget(
    item({
      id: "2",
      title: "Leer",
      at: "2026-09-06T10:00:00.000Z",
      module: "inventory_low_stock",
    }),
  );
  assert.deepEqual(target, { type: "inventory" });
});

test("Todo-Module öffnen Checklists-Sheet", () => {
  const target = resolveHeuteLiveSheetTarget(
    item({
      id: "3",
      title: "Todo",
      at: "2026-09-06T10:00:00.000Z",
      module: "staff_todo_completed",
    }),
  );
  assert.deepEqual(target, { type: "checklists" });
});

test("Unbekannte Module fallen auf Event-Detail zurück", () => {
  const row = item({
    id: "4",
    title: "Review",
    at: "2026-09-06T10:00:00.000Z",
    module: "reviews",
  });
  assert.deepEqual(resolveHeuteLiveSheetTarget(row), {
    type: "event",
    item: row,
  });
});
