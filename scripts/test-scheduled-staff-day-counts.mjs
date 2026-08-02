/**
 * Smoke-test for planned-staff day counts (unique staff, declined skipped).
 * Run: node scripts/test-scheduled-staff-day-counts.mjs
 */
import assert from "node:assert/strict";

function restaurantZonedDateKey(date, timeZone = "Europe/Berlin") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function countUniquePlannedStaffIds(rows) {
  const ids = new Set();
  for (const row of rows) {
    if (row.status === "declined") continue;
    if (!row.staff_id) continue;
    ids.add(row.staff_id);
  }
  return ids.size;
}

function countScheduledStaffByRestaurantDay(rows, timeZone = "Europe/Berlin") {
  const staffByDay = new Map();
  for (const row of rows) {
    if (row.status === "declined") continue;
    if (!row.staff_id) continue;
    const dayKey = restaurantZonedDateKey(new Date(row.starts_at), timeZone);
    const bucket = staffByDay.get(dayKey) ?? new Set();
    bucket.add(row.staff_id);
    staffByDay.set(dayKey, bucket);
  }
  const counts = new Map();
  for (const [dayKey, staffIds] of staffByDay) {
    counts.set(dayKey, staffIds.size);
  }
  return counts;
}

const tz = "Europe/Berlin";
const rows = [
  {
    staff_id: "a",
    starts_at: "2026-08-08T09:30:00.000Z", // 11:30 Berlin
    status: "confirmed",
  },
  {
    staff_id: "a",
    starts_at: "2026-08-08T16:00:00.000Z",
    status: "confirmed",
  },
  {
    staff_id: "b",
    starts_at: "2026-08-08T09:30:00.000Z",
    status: "confirmed",
  },
  {
    staff_id: "c",
    starts_at: "2026-08-08T10:00:00.000Z",
    status: "pending",
  },
  {
    staff_id: "d",
    starts_at: "2026-08-08T10:00:00.000Z",
    status: "declined",
  },
  {
    staff_id: "e",
    starts_at: "2026-08-07T09:30:00.000Z",
    status: "confirmed",
  },
];

assert.equal(countUniquePlannedStaffIds(rows.filter((r) => r.starts_at.startsWith("2026-08-08"))), 3);

const counts = countScheduledStaffByRestaurantDay(rows, tz);
assert.equal(counts.get("2026-08-08"), 3); // a,b,c — not declined d, not e (prev day)
assert.equal(counts.get("2026-08-07"), 1);

console.log("ok: scheduled staff day counts (starts_at + unique)");
