/**
 * Smoke-check: Übernacht-Schicht darf nicht an beiden Tagen voll zählen.
 * Run: node scripts/verify-staff-overnight-wage.mjs
 */

function localDayBoundsMs(dayYmd) {
  const [y, m, d] = dayYmd.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function clipMs(startsAt, endsAt, dayYmd) {
  const { startMs: dayStartMs, endMs: dayEndMs } = localDayBoundsMs(dayYmd);
  const entryStartMs = new Date(startsAt).getTime();
  const entryEndMs = new Date(endsAt).getTime();
  const clipStartMs = Math.max(entryStartMs, dayStartMs);
  const clipEndMs = Math.min(entryEndMs, dayEndMs);
  return Math.max(0, clipEndMs - clipStartMs);
}

const startsAt = "2026-07-15T20:00:00.000Z";
const endsAt = "2026-07-16T04:00:00.000Z";
const fullMs = new Date(endsAt) - new Date(startsAt);
const d1 = clipMs(startsAt, endsAt, "2026-07-15");
const d2 = clipMs(startsAt, endsAt, "2026-07-16");

if (d1 + d2 !== fullMs) {
  console.error("FAIL: clipped sum != full", { d1, d2, fullMs });
  process.exit(1);
}
if (d1 === fullMs || d2 === fullMs) {
  console.error("FAIL: one day still has full duration", { d1, d2, fullMs });
  process.exit(1);
}
const wageCents = Math.round(((d1 + d2) / 3_600_000) * 1800);
if (wageCents !== 14400) {
  console.error("FAIL: expected 144€", wageCents);
  process.exit(1);
}
console.log("OK overnight clip", {
  h1: d1 / 3_600_000,
  h2: d2 / 3_600_000,
  wageEuro: wageCents / 100,
});
