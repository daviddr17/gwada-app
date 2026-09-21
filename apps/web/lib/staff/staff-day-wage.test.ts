import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeStaffDayWageBreakdown,
  sumStaffWorkHoursForDay,
  sumTeamWorkHoursForDay,
} from "./staff-day-wage.ts";
import { computeDashboardStaffSummary } from "./compute-dashboard-staff-summary.ts";
import { displayShiftHoursBreakdown } from "./staff-work-hours-display.ts";
import { netWorkHoursFromWorkBreakEntries } from "./staff-work-hours-summary.ts";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffWorkEntryRow,
} from "@/lib/types/staff";

function workEntry(
  partial: Partial<RestaurantStaffWorkEntryRow> &
    Pick<
      RestaurantStaffWorkEntryRow,
      "id" | "entry_type" | "starts_at" | "ends_at"
    >,
): RestaurantStaffWorkEntryRow {
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

const hourlyContract = {
  id: "c1",
  restaurant_id: "r1",
  staff_id: "s1",
  valid_from: "2026-01-01",
  valid_to: null,
  pay_type: "hourly",
  hourly_rate_cents: 1500,
  fixed_salary_cents: null,
  currency: "EUR",
  note: null,
  employment_type_id: null,
  vacation_days_per_year: null,
  target_weekly_minutes: 40 * 60,
} as RestaurantStaffContractRow;

test("Lohn nutzt netWorkH (nicht aufgeblasenes Eingeloggt) bei überlappender Pause", () => {
  const entries = [
    workEntry({
      id: "w1",
      entry_type: "work",
      starts_at: "2026-08-25T07:30:00.000Z",
      ends_at: "2026-08-25T19:16:00.000Z",
      note: "Display",
    }),
    workEntry({
      id: "b1",
      entry_type: "break",
      starts_at: "2026-08-25T13:00:00.000Z",
      ends_at: "2026-08-25T14:00:00.000Z",
      shift_id: "orphan",
    }),
  ];
  const now = new Date("2026-08-26T12:00:00.000Z");
  const hours = netWorkHoursFromWorkBreakEntries(entries, now);
  const ui = displayShiftHoursBreakdown(entries, now);
  const dayNet = sumStaffWorkHoursForDay(
    entries,
    "s1",
    "2026-08-25",
    now,
    "UTC",
  );
  const wage = computeStaffDayWageBreakdown({
    entries,
    contracts: [hourlyContract],
    dayYmd: "2026-08-25",
    now,
    timeZone: "UTC",
  });

  assert.ok(Math.abs(hours.loggedH - 11.7666666667) < 1e-6);
  assert.ok(Math.abs(hours.netWorkH - 10.7666666667) < 1e-6);
  assert.ok(Math.abs(ui.netMs / 3_600_000 - hours.netWorkH) < 1e-9);
  assert.ok(Math.abs(dayNet - hours.netWorkH) < 1e-9);
  assert.equal(wage.lines.length, 1);
  assert.ok(Math.abs(wage.lines[0]!.workHours - hours.netWorkH) < 1e-9);
  assert.equal(wage.lines[0]!.wageCents, Math.round(hours.netWorkH * 1500));
  // Nicht Eingeloggt × Satz
  assert.notEqual(wage.lines[0]!.wageCents, Math.round(hours.loggedH * 1500));
});

test("Team-Stunden summieren pro Mitarbeiter (keine Union überlappender Schichten)", () => {
  const dayYmd = "2026-08-25";
  const now = new Date("2026-08-26T12:00:00.000Z");
  const tz = "UTC";
  const entries = [
    workEntry({
      id: "w-a",
      staff_id: "s-a",
      entry_type: "work",
      starts_at: "2026-08-25T08:00:00.000Z",
      ends_at: "2026-08-25T17:00:00.000Z",
    }),
    workEntry({
      id: "w-b",
      staff_id: "s-b",
      entry_type: "work",
      starts_at: "2026-08-25T08:00:00.000Z",
      ends_at: "2026-08-25T17:00:00.000Z",
    }),
    workEntry({
      id: "b-b",
      staff_id: "s-b",
      entry_type: "break",
      starts_at: "2026-08-25T12:00:00.000Z",
      ends_at: "2026-08-25T13:00:00.000Z",
    }),
  ];

  const perA = sumStaffWorkHoursForDay(entries, "s-a", dayYmd, now, tz);
  const perB = sumStaffWorkHoursForDay(entries, "s-b", dayYmd, now, tz);
  const team = sumTeamWorkHoursForDay(entries, dayYmd, now, tz);

  assert.ok(Math.abs(perA - 9) < 1e-9);
  assert.ok(Math.abs(perB - 8) < 1e-9);
  assert.ok(Math.abs(team - 17) < 1e-9);
  assert.notEqual(team, netWorkHoursFromWorkBreakEntries(entries, now).netWorkH);
});

test("Heute-Widget-Stunden = Summe der Tageslohn-Zeilen", () => {
  const dayYmd = "2026-08-25";
  const now = new Date("2026-08-26T12:00:00.000Z");
  const tz = "UTC";
  const entries = [
    workEntry({
      id: "w1",
      staff_id: "s1",
      entry_type: "work",
      starts_at: "2026-08-25T07:30:00.000Z",
      ends_at: "2026-08-25T19:16:00.000Z",
      note: "Display",
    }),
    workEntry({
      id: "b1",
      staff_id: "s1",
      entry_type: "break",
      starts_at: "2026-08-25T13:00:00.000Z",
      ends_at: "2026-08-25T14:00:00.000Z",
    }),
    workEntry({
      id: "w2",
      staff_id: "s2",
      entry_type: "work",
      starts_at: "2026-08-25T10:00:00.000Z",
      ends_at: "2026-08-25T18:00:00.000Z",
    }),
  ];
  const wage = computeStaffDayWageBreakdown({
    entries,
    contracts: [hourlyContract],
    dayYmd,
    now,
    timeZone: tz,
  });
  const wageHours = wage.lines.reduce((sum, line) => sum + line.workHours, 0);
  const summary = computeDashboardStaffSummary({
    staff: [],
    presence: [],
    todayEntries: entries,
    dayYmd,
    timeZone: tz,
    now,
  });

  assert.ok(Math.abs(summary.todayWorkHours - wageHours) < 1e-9);
});
