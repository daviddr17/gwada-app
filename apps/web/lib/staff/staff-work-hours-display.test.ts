import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clusterLegacyWorkBreakShifts,
  displayShiftHoursBreakdown,
  displayShiftNetWorkHours,
  displayShiftTitle,
  groupWorkHoursDayEntries,
} from "./staff-work-hours-display.ts";

type TestEntry = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  entry_type: "work" | "break" | "vacation" | "sick" | "other";
  starts_at: string;
  ends_at: string;
  note: string | null;
  is_open: boolean;
  shift_id: string | null;
  created_at: string;
  updated_at: string;
};

function entry(
  partial: Partial<TestEntry> &
    Pick<TestEntry, "id" | "entry_type" | "starts_at" | "ends_at">,
): TestEntry {
  return {
    restaurant_id: "r1",
    staff_id: "s1",
    note: null,
    is_open: false,
    shift_id: "shift-1",
    created_at: partial.starts_at,
    updated_at: partial.starts_at,
    ...partial,
  };
}

test("Display sequentiell: Netto = Arbeit, Presence = Arbeit+Pause", () => {
  const segments = [
    entry({
      id: "w1",
      entry_type: "work",
      starts_at: "2026-08-01T10:00:00.000Z",
      ends_at: "2026-08-01T14:00:00.000Z",
    }),
    entry({
      id: "b1",
      entry_type: "break",
      starts_at: "2026-08-01T14:00:00.000Z",
      ends_at: "2026-08-01T15:00:00.000Z",
    }),
    entry({
      id: "w2",
      entry_type: "work",
      starts_at: "2026-08-01T15:00:00.000Z",
      ends_at: "2026-08-01T19:00:00.000Z",
    }),
  ];

  assert.equal(displayShiftNetWorkHours(segments), 8);
  const b = displayShiftHoursBreakdown(segments);
  assert.equal(b.breakMs / 3_600_000, 1);
  assert.equal(b.netMs / 3_600_000, 8);
  assert.equal(b.presenceMs / 3_600_000, 9);
  assert.equal(b.overlapBreakMs, 0);
});

test("Pause in Work-Block: Netto = Presence − Pause", () => {
  const segments = [
    entry({
      id: "w1",
      entry_type: "work",
      starts_at: "2026-08-01T10:00:00.000Z",
      ends_at: "2026-08-01T18:00:00.000Z",
    }),
    entry({
      id: "b1",
      entry_type: "break",
      starts_at: "2026-08-01T13:00:00.000Z",
      ends_at: "2026-08-01T14:06:00.000Z",
    }),
  ];

  assert.ok(Math.abs(displayShiftNetWorkHours(segments) - 6.9) < 1e-9);
  const b = displayShiftHoursBreakdown(segments);
  assert.ok(Math.abs(b.breakMs / 3_600_000 - 1.1) < 1e-9);
  assert.ok(Math.abs(b.presenceMs / 3_600_000 - 8) < 1e-9);
  assert.ok(Math.abs(b.netMs / 3_600_000 - 6.9) < 1e-9);
});

test("Gemischt: nur überlappende Pause von Work abziehen", () => {
  const segments = [
    entry({
      id: "w1",
      entry_type: "work",
      starts_at: "2026-08-01T10:00:00.000Z",
      ends_at: "2026-08-01T14:00:00.000Z",
    }),
    entry({
      id: "b-seq",
      entry_type: "break",
      starts_at: "2026-08-01T14:00:00.000Z",
      ends_at: "2026-08-01T14:30:00.000Z",
    }),
    entry({
      id: "w2",
      entry_type: "work",
      starts_at: "2026-08-01T14:30:00.000Z",
      ends_at: "2026-08-01T18:00:00.000Z",
    }),
    entry({
      id: "b-in",
      entry_type: "break",
      starts_at: "2026-08-01T11:00:00.000Z",
      ends_at: "2026-08-01T11:30:00.000Z",
      note: "ArbZG-Korrektur (Auto)",
    }),
  ];

  assert.equal(displayShiftNetWorkHours(segments), 7);
  const b = displayShiftHoursBreakdown(segments);
  assert.equal(b.breakMs / 3_600_000, 1);
  assert.equal(b.netMs / 3_600_000, 7);
  assert.equal(b.presenceMs / 3_600_000, 8);
});

test("Legacy: alleinige Pause bleibt flacher Eintrag (kein Schicht 0,00)", () => {
  const items = clusterLegacyWorkBreakShifts([
    entry({
      id: "b1",
      entry_type: "break",
      starts_at: "2026-08-01T12:00:00.000Z",
      ends_at: "2026-08-01T12:30:00.000Z",
      shift_id: null,
      note: null,
    }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.kind, "entry");
  if (items[0]!.kind === "entry") {
    assert.equal(items[0]!.entry.id, "b1");
  }
});

test("Legacy: Arbeit+Pause wird als Schicht-Block gruppiert", () => {
  const items = clusterLegacyWorkBreakShifts([
    entry({
      id: "w1",
      entry_type: "work",
      starts_at: "2026-08-01T10:00:00.000Z",
      ends_at: "2026-08-01T14:00:00.000Z",
      shift_id: null,
    }),
    entry({
      id: "b1",
      entry_type: "break",
      starts_at: "2026-08-01T14:00:00.000Z",
      ends_at: "2026-08-01T14:30:00.000Z",
      shift_id: null,
    }),
    entry({
      id: "w2",
      entry_type: "work",
      starts_at: "2026-08-01T14:30:00.000Z",
      ends_at: "2026-08-01T18:00:00.000Z",
      shift_id: null,
    }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.kind, "display_shift");
  if (items[0]!.kind === "display_shift") {
    assert.equal(items[0]!.segments.length, 3);
  }
});

test("Orphan-Pause überlappt Display-Schicht: anhängen statt Schicht 0,00", () => {
  const items = groupWorkHoursDayEntries([
    entry({
      id: "w1",
      entry_type: "work",
      starts_at: "2026-08-01T10:00:00.000Z",
      ends_at: "2026-08-01T18:00:00.000Z",
      shift_id: "shift-1",
      note: "Display",
    }),
    entry({
      id: "b-orphan",
      entry_type: "break",
      starts_at: "2026-08-01T13:00:00.000Z",
      ends_at: "2026-08-01T13:30:00.000Z",
      shift_id: null,
      note: null,
    }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.kind, "display_shift");
  if (items[0]!.kind === "display_shift") {
    assert.equal(items[0]!.segments.length, 2);
    assert.ok(items[0]!.segments.some((s) => s.id === "b-orphan"));
  }
});

test("Pause mit eigener shift_id überlappt Display: anhängen statt Schicht 0,00", () => {
  const items = groupWorkHoursDayEntries([
    entry({
      id: "w1",
      entry_type: "work",
      starts_at: "2026-08-25T07:30:00.000Z",
      ends_at: "2026-08-25T19:16:00.000Z",
      shift_id: null,
      note: "Display",
    }),
    entry({
      id: "b1",
      entry_type: "break",
      starts_at: "2026-08-25T13:00:00.000Z",
      ends_at: "2026-08-25T14:00:00.000Z",
      shift_id: "break-only-shift",
      note: null,
    }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.kind, "display_shift");
  if (items[0]!.kind === "display_shift") {
    assert.equal(items[0]!.segments.length, 2);
    assert.equal(displayShiftTitle(items[0]!.segments), "Display-Schicht");
    const b = displayShiftHoursBreakdown(items[0]!.segments);
    assert.equal(b.overlapBreakMs / 3_600_000, 1);
  }
});

test("Pause-only shift_id ohne Work wird flacher Eintrag", () => {
  const items = groupWorkHoursDayEntries([
    entry({
      id: "b1",
      entry_type: "break",
      starts_at: "2026-08-25T13:00:00.000Z",
      ends_at: "2026-08-25T14:00:00.000Z",
      shift_id: "break-only-shift",
      note: null,
    }),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.kind, "entry");
});
