import assert from "node:assert/strict";
import { test } from "node:test";

import { netWorkHoursFromWorkBreakEntries } from "./staff-work-hours-summary.ts";

type TestEntry = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  entry_type: "work" | "break";
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
    shift_id: null,
    created_at: partial.starts_at,
    updated_at: partial.starts_at,
    ...partial,
  };
}

test("Überlappende Pause: Eingeloggt bleibt, Netto − Pause (kein Doppel)", () => {
  const work = entry({
    id: "w1",
    entry_type: "work",
    starts_at: "2026-08-25T07:30:00.000Z",
    ends_at: "2026-08-25T19:16:00.000Z",
    note: "Display",
  });
  const onlyWork = netWorkHoursFromWorkBreakEntries([work]);
  const withBreak = netWorkHoursFromWorkBreakEntries([
    work,
    entry({
      id: "b1",
      entry_type: "break",
      starts_at: "2026-08-25T13:00:00.000Z",
      ends_at: "2026-08-25T14:00:00.000Z",
      shift_id: "orphan",
    }),
  ]);

  assert.ok(Math.abs(onlyWork.loggedH - 11.7666666667) < 1e-6);
  assert.equal(onlyWork.breakH, 0);
  assert.ok(Math.abs(onlyWork.netWorkH - onlyWork.loggedH) < 1e-9);

  // Fatal regression: Eingeloggt must NOT rise by the pause length.
  assert.ok(Math.abs(withBreak.loggedH - onlyWork.loggedH) < 1e-9);
  assert.equal(withBreak.breakH, 1);
  assert.ok(Math.abs(withBreak.netWorkH - (onlyWork.netWorkH - 1)) < 1e-9);
});

test("Sequentiell Work|Pause|Work: Eingeloggt = Spanne, Netto = Arbeit", () => {
  const h = netWorkHoursFromWorkBreakEntries([
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
  ]);
  assert.equal(h.loggedH, 9);
  assert.equal(h.breakH, 1);
  assert.equal(h.netWorkH, 8);
});

test("Pause außerhalb Work: Eingeloggt steigt, Netto unverändert", () => {
  const h = netWorkHoursFromWorkBreakEntries([
    entry({
      id: "w1",
      entry_type: "work",
      starts_at: "2026-08-01T10:00:00.000Z",
      ends_at: "2026-08-01T18:00:00.000Z",
    }),
    entry({
      id: "b1",
      entry_type: "break",
      starts_at: "2026-08-01T19:00:00.000Z",
      ends_at: "2026-08-01T19:30:00.000Z",
    }),
  ]);
  assert.equal(h.loggedH, 8.5);
  assert.equal(h.breakH, 0.5);
  assert.equal(h.netWorkH, 8);
});

test("Überlappende Work-Segmente: Union ohne Doppelzählung", () => {
  const h = netWorkHoursFromWorkBreakEntries([
    entry({
      id: "w1",
      entry_type: "work",
      starts_at: "2026-08-01T10:00:00.000Z",
      ends_at: "2026-08-01T14:00:00.000Z",
    }),
    entry({
      id: "w2",
      entry_type: "work",
      starts_at: "2026-08-01T12:00:00.000Z",
      ends_at: "2026-08-01T16:00:00.000Z",
    }),
  ]);
  assert.equal(h.loggedH, 6);
  assert.equal(h.netWorkH, 6);
  assert.equal(h.breakH, 0);
});

test("Offener Work-Eintrag: Dauer bis now", () => {
  const now = new Date("2026-08-01T15:00:00.000Z");
  const h = netWorkHoursFromWorkBreakEntries(
    [
      entry({
        id: "w1",
        entry_type: "work",
        starts_at: "2026-08-01T10:00:00.000Z",
        ends_at: "2026-08-01T10:00:00.000Z",
        is_open: true,
      }),
    ],
    now,
  );
  assert.equal(h.loggedH, 5);
  assert.equal(h.netWorkH, 5);
});
