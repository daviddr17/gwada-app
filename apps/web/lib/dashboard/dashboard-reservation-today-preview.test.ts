import assert from "node:assert/strict";
import { test } from "node:test";

import { dashboardTodayUpcomingPreview } from "./dashboard-reservation-today-preview.ts";

test("höchstens fünf Zeilen, Alle anzeigen erst ab der sechsten", () => {
  const five = dashboardTodayUpcomingPreview([1, 2, 3, 4, 5]);
  assert.deepEqual(five.preview, [1, 2, 3, 4, 5]);
  assert.equal(five.showAll, false);

  const six = dashboardTodayUpcomingPreview([1, 2, 3, 4, 5, 6]);
  assert.deepEqual(six.preview, [1, 2, 3, 4, 5]);
  assert.equal(six.showAll, true);
});

test("leerer Tag hat keine Zeilen und keinen Hinweis", () => {
  const empty = dashboardTodayUpcomingPreview([]);
  assert.deepEqual(empty.preview, []);
  assert.equal(empty.showAll, false);
});
