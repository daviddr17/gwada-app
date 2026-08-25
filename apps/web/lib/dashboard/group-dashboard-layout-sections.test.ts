import assert from "node:assert/strict";
import { test } from "node:test";

import {
  groupDashboardLayoutSections,
  groupDashboardMasonryRuns,
} from "./group-dashboard-layout-sections.ts";

test("Heute spannt volle Breite, Rest eine Spalte", () => {
  const sections = groupDashboardLayoutSections([
    "heute",
    "reservations",
    "weather",
    "messages",
  ]);
  assert.deepEqual(
    sections.map((s) => [s.id, s.span]),
    [
      ["heute", 2],
      ["reservations", 1],
      ["weather", 1],
      ["messages", 1],
    ],
  );
});

test("Masonry-Runs: Heute außerhalb der Columns, Rest zusammen", () => {
  const runs = groupDashboardMasonryRuns(
    groupDashboardLayoutSections([
      "heute",
      "reservations",
      "weather",
      "messages",
    ]),
  );
  assert.equal(runs.length, 2);
  assert.equal(runs[0]?.type, "full");
  assert.deepEqual(
    runs[0]?.items.map((s) => s.id),
    ["heute"],
  );
  assert.equal(runs[1]?.type, "columns");
  assert.deepEqual(
    runs[1]?.items.map((s) => s.id),
    ["reservations", "weather", "messages"],
  );
});

test("Masonry-Runs behalten Heute in der Mitte als eigenen Block", () => {
  const runs = groupDashboardMasonryRuns(
    groupDashboardLayoutSections(["reservations", "heute", "weather"]),
  );
  assert.deepEqual(
    runs.map((r) => [r.type, r.items.map((s) => s.id)]),
    [
      ["columns", ["reservations"]],
      ["full", ["heute"]],
      ["columns", ["weather"]],
    ],
  );
});
