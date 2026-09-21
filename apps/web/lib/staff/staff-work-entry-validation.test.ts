import assert from "node:assert/strict";
import { test } from "node:test";

import { validateStaffWorkEntryTiming } from "./staff-work-entry-validation";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";

function iso(hour: number, minute: number): string {
  return new Date(2026, 8, 21, hour, minute, 0, 0).toISOString();
}

function entry(
  partial: Pick<RestaurantStaffWorkEntryRow, "id" | "entry_type" | "starts_at" | "ends_at"> &
    Partial<RestaurantStaffWorkEntryRow>,
): RestaurantStaffWorkEntryRow {
  return {
    restaurant_id: "r",
    staff_id: "s",
    note: "Display",
    is_open: false,
    shift_id: "shift-1",
    ...partial,
  };
}

test("Display-Pause zwischen Arbeitsblöcken lässt sich verschieben", () => {
  const workBefore = entry({
    id: "w1",
    entry_type: "work",
    starts_at: iso(9, 0),
    ends_at: iso(12, 0),
  });
  const pause = entry({
    id: "b1",
    entry_type: "break",
    starts_at: iso(12, 0),
    ends_at: iso(12, 30),
  });
  const workAfter = entry({
    id: "w2",
    entry_type: "work",
    starts_at: iso(12, 30),
    ends_at: iso(17, 0),
  });
  const result = validateStaffWorkEntryTiming({
    entryType: "break",
    startsAt: iso(12, 5),
    endsAt: iso(12, 20),
    staffId: "s",
    entryId: "b1",
    siblings: [workBefore, pause, workAfter],
  });
  assert.equal(result.ok, true);
});

test("Display-Pause darf die folgende Arbeitszeit nicht überdecken", () => {
  const workBefore = entry({
    id: "w1",
    entry_type: "work",
    starts_at: iso(9, 0),
    ends_at: iso(12, 0),
  });
  const pause = entry({
    id: "b1",
    entry_type: "break",
    starts_at: iso(12, 0),
    ends_at: iso(12, 30),
  });
  const workAfter = entry({
    id: "w2",
    entry_type: "work",
    starts_at: iso(12, 30),
    ends_at: iso(17, 0),
  });
  const result = validateStaffWorkEntryTiming({
    entryType: "break",
    startsAt: iso(12, 0),
    endsAt: iso(13, 0),
    staffId: "s",
    entryId: "b1",
    siblings: [workBefore, pause, workAfter],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, /Arbeitszeit/);
});

test("Pause innerhalb einer durchgehenden Arbeitszeit bleibt gültig", () => {
  const work = entry({
    id: "w1",
    entry_type: "work",
    starts_at: iso(9, 0),
    ends_at: iso(17, 0),
    shift_id: null,
    note: null,
  });
  const pause = entry({
    id: "b1",
    entry_type: "break",
    starts_at: iso(12, 0),
    ends_at: iso(12, 30),
    shift_id: null,
    note: null,
  });
  const result = validateStaffWorkEntryTiming({
    entryType: "break",
    startsAt: iso(12, 10),
    endsAt: iso(12, 40),
    staffId: "s",
    entryId: "b1",
    siblings: [work, pause],
  });
  assert.equal(result.ok, true);
});
