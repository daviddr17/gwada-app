import assert from "node:assert/strict";
import { test } from "node:test";

import { hasDashboardWidgetAccess } from "./dashboard-widget-permissions.ts";

const hasAll = () => true;

test("Wetter bleibt sichtbar während Status-Refetch wenn bereits verfügbar", () => {
  assert.equal(
    hasDashboardWidgetAccess(hasAll, "weather", {
      weatherLoading: true,
      weatherAvailable: true,
    }),
    true,
  );
});

test("Wetter ausgeblendet wenn Status bestätigt nicht verfügbar", () => {
  assert.equal(
    hasDashboardWidgetAccess(hasAll, "weather", {
      weatherLoading: false,
      weatherAvailable: false,
    }),
    false,
  );
});

test("Wetter ausgeblendet beim ersten Laden bevor Status bestätigt", () => {
  assert.equal(
    hasDashboardWidgetAccess(hasAll, "weather", {
      weatherLoading: true,
      weatherAvailable: false,
    }),
    false,
  );
});
