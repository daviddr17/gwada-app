import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultWeeklyHours } from "@/lib/constants/restaurant-profile";
import {
  fromFacebookPageHours,
  toFacebookHours,
} from "@/lib/integrations/opening-hours-platform-format";

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
