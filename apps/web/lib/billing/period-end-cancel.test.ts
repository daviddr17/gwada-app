import assert from "node:assert/strict";
import test from "node:test";

function periodEndStillActive(
  periodEndIso: string | null,
  now = new Date(),
): boolean {
  if (!periodEndIso) return false;
  const ms = Date.parse(periodEndIso);
  if (!Number.isFinite(ms)) return false;
  return ms > now.getTime();
}

function mollieStartDateFromPeriodEnd(
  periodEndIso: string | null,
  now = new Date(),
): string | undefined {
  if (!periodEndIso) return undefined;
  const ms = Date.parse(periodEndIso);
  if (!Number.isFinite(ms)) return undefined;
  const ymd = new Date(ms).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  if (ymd < today) return undefined;
  return ymd;
}

test("period-end soft cancel stays active until period end", () => {
  const now = new Date("2026-11-06T12:00:00.000Z");
  assert.equal(
    periodEndStillActive("2026-11-06T00:00:00.000Z", now),
    false,
  );
  assert.equal(
    periodEndStillActive("2026-11-07T00:00:00.000Z", now),
    true,
  );
  assert.equal(periodEndStillActive(null, now), false);
});

test("undo recreate uses period end as Mollie startDate when still future", () => {
  const now = new Date("2026-11-06T12:00:00.000Z");
  assert.equal(
    mollieStartDateFromPeriodEnd("2026-12-01T00:00:00.000Z", now),
    "2026-12-01",
  );
  assert.equal(
    mollieStartDateFromPeriodEnd("2026-11-05T00:00:00.000Z", now),
    undefined,
  );
});
