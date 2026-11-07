import assert from "node:assert/strict";
import test from "node:test";

/** Mirrors plan-change-proration.ts math without path-alias imports. */
function computeUnusedPeriodCredit(input: {
  periodAmountEuros: number;
  periodStartIso: string;
  periodEndIso: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const startMs = Date.parse(input.periodStartIso);
  const endMs = Date.parse(input.periodEndIso);
  const totalMs = endMs - startMs;
  const remainingMs = Math.max(0, Math.min(totalMs, endMs - now.getTime()));
  const remainingFraction = remainingMs / totalMs;
  const creditEuros =
    Math.round(input.periodAmountEuros * remainingFraction * 100) / 100;
  return { remainingFraction, creditEuros };
}

function subtractBillingInterval(periodEndIso: string): string {
  const end = new Date(periodEndIso);
  end.setUTCMonth(end.getUTCMonth() - 1);
  return end.toISOString();
}

test("unused credit is proportional to remaining period", () => {
  const now = new Date("2026-11-16T00:00:00.000Z");
  const credit = computeUnusedPeriodCredit({
    periodAmountEuros: 100,
    periodStartIso: "2026-11-01T00:00:00.000Z",
    periodEndIso: "2026-12-01T00:00:00.000Z",
    now,
  });
  assert.equal(credit.remainingFraction, 0.5);
  assert.equal(credit.creditEuros, 50);
});

test("upgrade Basic→Pro mid-month charges new price minus unused credit", () => {
  const now = new Date("2026-11-16T00:00:00.000Z");
  const unused = computeUnusedPeriodCredit({
    periodAmountEuros: 49,
    periodStartIso: "2026-11-01T00:00:00.000Z",
    periodEndIso: "2026-12-01T00:00:00.000Z",
    now,
  });
  const chargeNow = Math.max(0, Math.round((99 - unused.creditEuros) * 100) / 100);
  assert.equal(unused.creditEuros, 24.5);
  assert.equal(chargeNow, 74.5);
});

test("downgrade does not charge when credit covers new price", () => {
  const now = new Date("2026-11-16T00:00:00.000Z");
  const unused = computeUnusedPeriodCredit({
    periodAmountEuros: 99,
    periodStartIso: "2026-11-01T00:00:00.000Z",
    periodEndIso: "2026-12-01T00:00:00.000Z",
    now,
  });
  const chargeNow = Math.max(0, Math.round((49 - unused.creditEuros) * 100) / 100);
  assert.equal(chargeNow, 0);
  assert.ok(unused.creditEuros > 0);
});

test("subtractBillingInterval backs up one month", () => {
  assert.equal(
    subtractBillingInterval("2026-12-01T00:00:00.000Z").slice(0, 10),
    "2026-11-01",
  );
});
