import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultWeeklyHours } from "@/lib/constants/restaurant-profile";
import {
  fromFacebookPageHours,
  fromGoogleRegularHours,
  toFacebookHours,
  toGoogleRegularHours,
  weeklyHoursEqual,
} from "@/lib/integrations/opening-hours-platform-format";
import type { DayHours, Weekday } from "@/lib/types/restaurant";

function weeklyWith(
  overrides: Partial<Record<Weekday, DayHours>>,
): Record<Weekday, DayHours> {
  const weekly = defaultWeeklyHours();
  for (const day of Object.keys(weekly) as Weekday[]) {
    weekly[day] = { closed: true };
  }
  for (const [day, hours] of Object.entries(overrides) as Array<
    [Weekday, DayHours]
  >) {
    weekly[day] = hours;
  }
  return weekly;
}

function assertWeeklyHoursEqualAfterGoogleRoundTrip(
  local: Record<Weekday, DayHours>,
  message?: string,
) {
  const googlePayload = toGoogleRegularHours(local);
  const parsed = fromGoogleRegularHours(googlePayload);
  assert.equal(
    weeklyHoursEqual(local, parsed),
    true,
    message ?? "round-trip should match local weekly hours",
  );
}

test("toFacebookHours uses Meta flat keys mon_1_open / mon_1_close", () => {
  const weekly = defaultWeeklyHours();
  for (const day of Object.keys(weekly) as Array<keyof typeof weekly>) {
    weekly[day] = { closed: true };
  }
  weekly.monday = { closed: false, open: "11:00", close: "22:00" };
  weekly.wednesday = { closed: false, open: "09:30", close: "17:00" };

  assert.deepEqual(toFacebookHours(weekly), {
    mon_1_open: "11:00",
    mon_1_close: "22:00",
    wed_1_open: "09:30",
    wed_1_close: "17:00",
  });
});

test("fromFacebookPageHours parses flat Meta hours", () => {
  const weekly = fromFacebookPageHours({
    mon_1_open: "10:00",
    mon_1_close: "23:00",
    fri_1_open: "18:00",
    fri_1_close: "02:00",
  });
  assert.deepEqual(weekly.monday, {
    closed: false,
    open: "10:00",
    close: "23:00",
  });
  assert.deepEqual(weekly.friday, {
    closed: false,
    open: "18:00",
    close: "02:00",
  });
});

test("fromGoogleRegularHours round-trips regular same-day hours", () => {
  const local = weeklyWith({
    monday: { closed: false, open: "11:30", close: "22:00" },
    tuesday: { closed: false, open: "09:00", close: "17:00" },
  });
  assertWeeklyHoursEqualAfterGoogleRoundTrip(local);
});

test("fromGoogleRegularHours round-trips overnight hours", () => {
  const local = weeklyWith({
    friday: { closed: false, open: "18:00", close: "02:00" },
  });
  assertWeeklyHoursEqualAfterGoogleRoundTrip(local);
});

test("fromGoogleRegularHours round-trips until-midnight hours", () => {
  const local = weeklyWith({
    saturday: { closed: false, open: "11:30", close: "00:00" },
  });
  assertWeeklyHoursEqualAfterGoogleRoundTrip(local);
});

test("fromGoogleRegularHours normalizes Google closeTime 24:00 on same day", () => {
  const parsed = fromGoogleRegularHours({
    periods: [
      {
        openDay: "MONDAY",
        closeDay: "MONDAY",
        openTime: { hours: 11, minutes: 30 },
        closeTime: { hours: 24, minutes: 0 },
      },
    ],
  });
  assert.deepEqual(parsed.monday, {
    closed: false,
    open: "11:30",
    close: "00:00",
  });

  const local = weeklyWith({
    monday: { closed: false, open: "11:30", close: "00:00" },
  });
  assert.equal(weeklyHoursEqual(local, parsed), true);
});

test("fromGoogleRegularHours merges split overnight periods at midnight", () => {
  const parsed = fromGoogleRegularHours({
    periods: [
      {
        openDay: "FRIDAY",
        closeDay: "FRIDAY",
        openTime: { hours: 18, minutes: 0 },
        closeTime: { hours: 24, minutes: 0 },
      },
      {
        openDay: "SATURDAY",
        closeDay: "SATURDAY",
        openTime: { hours: 0, minutes: 0 },
        closeTime: { hours: 2, minutes: 0 },
      },
    ],
  });
  assert.deepEqual(parsed.friday, {
    closed: false,
    open: "18:00",
    close: "02:00",
  });
  assert.deepEqual(parsed.saturday, { closed: true });

  const local = weeklyWith({
    friday: { closed: false, open: "18:00", close: "02:00" },
  });
  assert.equal(weeklyHoursEqual(local, parsed), true);
});

test("fromGoogleRegularHours accepts string times from Google API", () => {
  const parsed = fromGoogleRegularHours({
    periods: [
      {
        openDay: "WEDNESDAY",
        closeDay: "WEDNESDAY",
        openTime: "09:30",
        closeTime: "17:00",
      },
    ],
  });
  assert.deepEqual(parsed.wednesday, {
    closed: false,
    open: "09:30",
    close: "17:00",
  });
});

test("weeklyHoursEqual treats 24:00 close as 00:00 for comparison", () => {
  const local = weeklyWith({
    monday: { closed: false, open: "11:30", close: "00:00" },
  });
  const remote = weeklyWith({
    monday: { closed: false, open: "11:30", close: "24:00" },
  });
  assert.equal(weeklyHoursEqual(local, remote), true);
});

test("fromGoogleRegularHours treats omitted proto3 zero minutes as :00", () => {
  const parsed = fromGoogleRegularHours({
    periods: [
      {
        openDay: "MONDAY",
        closeDay: "MONDAY",
        openTime: { hours: 11, minutes: 30 },
        closeTime: { hours: 22 },
      },
      {
        openDay: "TUESDAY",
        closeDay: "TUESDAY",
        openTime: { hours: 12 },
        closeTime: { hours: 21, minutes: 30 },
      },
    ],
  });
  assert.deepEqual(parsed.monday, {
    closed: false,
    open: "11:30",
    close: "22:00",
  });
  assert.deepEqual(parsed.tuesday, {
    closed: false,
    open: "12:00",
    close: "21:30",
  });

  const local = weeklyWith({
    monday: { closed: false, open: "11:30", close: "22:00" },
    tuesday: { closed: false, open: "12:00", close: "21:30" },
  });
  assert.equal(weeklyHoursEqual(local, parsed), true);
});

test("fromGoogleRegularHours treats omitted proto3 midnight defaults as 00:00", () => {
  const parsed = fromGoogleRegularHours({
    periods: [
      {
        openDay: "FRIDAY",
        closeDay: "SATURDAY",
        openTime: { hours: 18 },
        closeTime: {},
      },
    ],
  });
  assert.deepEqual(parsed.friday, {
    closed: false,
    open: "18:00",
    close: "00:00",
  });
});
