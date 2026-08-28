import assert from "node:assert/strict";
import { test } from "node:test";

import { analyzeStaffDayWork, suggestBreakFixForDay } from "./de-arbzg-rules.ts";
import { evaluateDeArbzgDay, evaluateDeArbzgWeekly } from "./de-arbzg-evaluators.ts";

test("8h ohne Pause → Mindestpause 30 min fehlt", () => {
  const analysis = analyzeStaffDayWork({
    staffId: "s1",
    dayYmd: "2026-01-15",
    workEntries: [
      {
        id: "w1",
        starts_at: "2026-01-15T11:00:00.000Z",
        ends_at: "2026-01-15T19:00:00.000Z",
      },
    ],
    breakEntries: [],
  });
  assert.equal(analysis?.netWorkMinutes, 8 * 60);
  const violations = evaluateDeArbzgDay(analysis!);
  assert.ok(violations.some((v) => v.code === "missing_break"));
  assert.ok(violations.some((v) => v.code === "continuous_work_exceeded"));
  assert.ok(violations[0]?.title);
  assert.ok(violations[0]?.hint);
});

test("Teildienst 4h + 4h mit 4h Lücke → Pause erfüllt", () => {
  const analysis = analyzeStaffDayWork({
    staffId: "s1",
    dayYmd: "2026-01-15",
    workEntries: [
      {
        id: "w1",
        starts_at: "2026-01-15T09:00:00.000Z",
        ends_at: "2026-01-15T13:00:00.000Z",
      },
      {
        id: "w2",
        starts_at: "2026-01-15T17:00:00.000Z",
        ends_at: "2026-01-15T21:00:00.000Z",
      },
    ],
    breakEntries: [],
  });
  assert.equal(analysis?.netWorkMinutes, 8 * 60);
  assert.equal(analysis?.implicitBreakMinutes, 4 * 60);
  const violations = evaluateDeArbzgDay(analysis!);
  assert.equal(violations.filter((v) => v.code === "missing_break").length, 0);
});

test("Wochenarbeitszeit > 48 h", () => {
  const analyses = ["2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15", "2026-01-16"].map(
    (dayYmd, i) =>
      analyzeStaffDayWork({
        staffId: "s1",
        dayYmd,
        workEntries: [
          {
            id: `w${i}`,
            starts_at: `${dayYmd}T08:00:00.000Z`,
            ends_at: `${dayYmd}T18:00:00.000Z`,
          },
        ],
        breakEntries: [],
      })!,
  );
  const weekViolation = evaluateDeArbzgWeekly({
    staffId: "s1",
    weekMondayYmd: "2026-01-12",
    analyses,
  });
  assert.ok(weekViolation);
  assert.equal(weekViolation?.code, "weekly_hours_exceeded");
});

test("suggestBreakFix extend_end verlängert Ausstempeln", () => {
  const analysis = analyzeStaffDayWork({
    staffId: "s1",
    dayYmd: "2026-01-15",
    workEntries: [
      {
        id: "w1",
        starts_at: "2026-01-15T11:00:00.000Z",
        ends_at: "2026-01-15T19:00:00.000Z",
      },
    ],
    breakEntries: [],
  });
  const fix = suggestBreakFixForDay(analysis!, "extend_end");
  assert.equal(fix?.mode, "extend_end");
  assert.equal(fix?.extendedWorkEndIso, "2026-01-15T19:30:00.000Z");
});
