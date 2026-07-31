/**
 * Smoke-test for scheduled staff day counting (overlap + unique staff).
 * Run: node scripts/test-scheduled-staff-day-counts.mjs
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const tsPath = path.join(
  root,
  "apps/web/lib/staff/scheduled-staff-day-counts.ts",
);

// Prefer compiled-free import via tsx if available; else inline port of logic.
async function loadHelpers() {
  try {
    const mod = await import(
      pathToFileURL(
        path.join(root, "apps/web/lib/staff/scheduled-staff-day-counts.ts"),
      ).href
    );
    return mod;
  } catch {
    // Inline mirror for environments without TS loader.
    const DEFAULT_TZ = "Europe/Berlin";
    function restaurantZonedDateKey(date, timeZone = DEFAULT_TZ) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(date);
    }
    function addRestaurantCalendarDaysYmd(ymd, deltaDays) {
      const [y, m, d] = ymd.split("-").map(Number);
      const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
      return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
    }
    function restaurantDaysOverlappedByShift(startsAtIso, endsAtIso, timeZone = DEFAULT_TZ) {
      const startsAt = new Date(startsAtIso);
      const endsAt = new Date(endsAtIso);
      if (!(endsAt > startsAt)) return [];
      const lastInstant = new Date(endsAt.getTime() - 1);
      let ymd = restaurantZonedDateKey(startsAt, timeZone);
      const endYmd = restaurantZonedDateKey(lastInstant, timeZone);
      const days = [];
      for (let i = 0; i < 62; i++) {
        days.push(ymd);
        if (ymd === endYmd) break;
        ymd = addRestaurantCalendarDaysYmd(ymd, 1);
      }
      return days;
    }
    function countScheduledStaffByRestaurantDay(rows, timeZone = DEFAULT_TZ) {
      const staffByDay = new Map();
      for (const row of rows) {
        if (row.status === "declined") continue;
        if (!row.staff_id) continue;
        for (const dayKey of restaurantDaysOverlappedByShift(
          row.starts_at,
          row.ends_at,
          timeZone,
        )) {
          const bucket = staffByDay.get(dayKey) ?? new Set();
          bucket.add(row.staff_id);
          staffByDay.set(dayKey, bucket);
        }
      }
      const counts = new Map();
      for (const [dayKey, staffIds] of staffByDay) {
        counts.set(dayKey, staffIds.size);
      }
      return counts;
    }
    return { restaurantDaysOverlappedByShift, countScheduledStaffByRestaurantDay };
  }
}

const {
  restaurantDaysOverlappedByShift,
  countScheduledStaffByRestaurantDay,
} = await loadHelpers();

const tz = "Europe/Berlin";

// Same-day shift
assert.deepEqual(
  restaurantDaysOverlappedByShift(
    "2026-08-04T07:00:00.000Z", // 09:00 Berlin
    "2026-08-04T15:00:00.000Z", // 17:00 Berlin
    tz,
  ),
  ["2026-08-04"],
);

// Overnight closer: counts start day + next morning
assert.deepEqual(
  restaurantDaysOverlappedByShift(
    "2026-08-03T20:00:00.000Z", // 22:00 Berlin Aug 3
    "2026-08-04T00:00:00.000Z", // 02:00 Berlin Aug 4
    tz,
  ),
  ["2026-08-03", "2026-08-04"],
);

// Ends exactly at midnight → only previous day (half-open)
assert.deepEqual(
  restaurantDaysOverlappedByShift(
    "2026-08-03T20:00:00.000Z",
    "2026-08-03T22:00:00.000Z", // midnight Berlin Aug 4
    tz,
  ),
  ["2026-08-03"],
);

const rows = [
  {
    staff_id: "a",
    starts_at: "2026-08-04T07:00:00.000Z",
    ends_at: "2026-08-04T15:00:00.000Z",
    status: "confirmed",
  },
  {
    staff_id: "a",
    starts_at: "2026-08-04T16:00:00.000Z",
    ends_at: "2026-08-04T20:00:00.000Z",
    status: "confirmed",
  },
  {
    staff_id: "b",
    starts_at: "2026-08-04T07:00:00.000Z",
    ends_at: "2026-08-04T15:00:00.000Z",
    status: "confirmed",
  },
  {
    staff_id: "c",
    starts_at: "2026-08-03T20:00:00.000Z",
    ends_at: "2026-08-04T00:00:00.000Z",
    status: "confirmed",
  },
  {
    staff_id: "d",
    starts_at: "2026-08-04T07:00:00.000Z",
    ends_at: "2026-08-04T15:00:00.000Z",
    status: "declined",
  },
  {
    staff_id: "e",
    starts_at: "2026-08-04T07:00:00.000Z",
    ends_at: "2026-08-04T15:00:00.000Z",
    status: "pending",
  },
];

const counts = countScheduledStaffByRestaurantDay(rows, tz);
// a (unique), b, c (overnight into Aug 4), e (pending) — not d declined
assert.equal(counts.get("2026-08-04"), 4);
assert.equal(counts.get("2026-08-03"), 1);

console.log("ok: scheduled staff day counts");
void createRequire;
void tsPath;
