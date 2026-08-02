/**
 * Heute-Widget: Übernacht + Netto wie Lohn — nicht volle Work-Summe ohne Clip.
 * Run: node scripts/verify-dashboard-heute-hours.mjs
 *
 * Simuliert Restaurant Europe/Berlin auf UTC-Server (Cloud/VPS).
 */

function restaurantDayBoundsMs(dayYmd, timeZone) {
  // Approximation matching restaurantDayBoundsIso for Europe/Berlin in CEST (UTC+2).
  // 2026-08-01 Berlin = 2026-07-31T22:00:00.000Z … 2026-08-01T22:00:00.000Z
  if (timeZone !== "Europe/Berlin") {
    throw new Error("test only covers Europe/Berlin");
  }
  const [y, m, d] = dayYmd.split("-").map(Number);
  // CEST: local midnight = UTC 22:00 previous calendar day
  const start = Date.UTC(y, m - 1, d, 0, 0, 0) - 2 * 3_600_000;
  const end = start + 24 * 3_600_000;
  return { startMs: start, endMs: end };
}

function clipMs(startsAt, endsAt, dayYmd, timeZone, nowMs) {
  const { startMs: dayStartMs, endMs: dayEndMs } = restaurantDayBoundsMs(
    dayYmd,
    timeZone,
  );
  const entryStartMs = new Date(startsAt).getTime();
  const entryEndMs = endsAt == null ? nowMs : new Date(endsAt).getTime();
  const clipStartMs = Math.max(entryStartMs, dayStartMs);
  const clipEndMs = Math.min(entryEndMs, dayEndMs);
  return Math.max(0, clipEndMs - clipStartMs);
}

const tz = "Europe/Berlin";
const day = "2026-08-01";
// Freitag 22:00 – Samstag 02:00 Berlin (= 20:00–00:00 UTC)
const overnightStart = "2026-07-31T20:00:00.000Z";
const overnightEnd = "2026-08-01T00:00:00.000Z";
// Samstag 10:00–14:00 Berlin
const dayShiftStart = "2026-08-01T08:00:00.000Z";
const dayShiftEnd = "2026-08-01T12:00:00.000Z";
const nowMs = new Date("2026-08-01T13:00:00.000Z").getTime(); // 15:00 Berlin

// Alte Widget-Logik: nur starts_at im Tag → Overnight fehlt, volle Dauer Tagesschicht
const oldWidgetMs =
  new Date(dayShiftEnd).getTime() - new Date(dayShiftStart).getTime();
// Overnight started previous day → excluded
const oldH = oldWidgetMs / 3_600_000;

// Neue Logik: Overlap + Clip
const overnightToday = clipMs(
  overnightStart,
  overnightEnd,
  day,
  tz,
  nowMs,
);
const dayShiftToday = clipMs(dayShiftStart, dayShiftEnd, day, tz, nowMs);
const newH = (overnightToday + dayShiftToday) / 3_600_000;

if (Math.abs(oldH - 4) > 1e-9) {
  console.error("FAIL: expected old day-shift 4h", oldH);
  process.exit(1);
}
// Overnight portion Sat 00:00–02:00 Berlin = 2h
if (Math.abs(overnightToday / 3_600_000 - 2) > 1e-9) {
  console.error("FAIL: overnight today portion", overnightToday / 3_600_000);
  process.exit(1);
}
if (Math.abs(newH - 6) > 1e-9) {
  console.error("FAIL: expected 6h total", newH);
  process.exit(1);
}

// Offene Schicht seit gestern 20:00 Berlin → heute bis 15:00 Berlin clippen (= 15h)
const openStart = "2026-07-31T18:00:00.000Z"; // 20:00 Berlin Fri
const openToday = clipMs(openStart, null, day, tz, nowMs);
const openH = openToday / 3_600_000;
if (Math.abs(openH - 15) > 1e-9) {
  console.error("FAIL: open overnight today portion", openH);
  process.exit(1);
}

// Volle Dauer ohne Clip wäre ~19h (Fri 20:00–Sat 15:00) — darf nicht als „heute“ gelten
const fullOpenH =
  (nowMs - new Date(openStart).getTime()) / 3_600_000;
if (!(fullOpenH > openH + 3)) {
  console.error("FAIL: expected full open >> clipped", { fullOpenH, openH });
  process.exit(1);
}

console.log("OK dashboard heute hours", {
  oldWidgetH: oldH,
  newWidgetH: newH,
  overnightTodayH: overnightToday / 3_600_000,
  openTodayH: openH,
  fullOpenWouldBeH: fullOpenH,
});
