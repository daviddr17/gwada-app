import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatInsightsTrendPercent,
  insightsPercentChange,
  insightsPreviousEqualYmdRange,
} from "./insights-period-trend.ts";

test("insightsPreviousEqualYmdRange keeps equal inclusive span", () => {
  // Oct 22–29 = 8 inclusive days → previous Oct 14–21
  assert.deepEqual(insightsPreviousEqualYmdRange("2026-10-22", "2026-10-29"), {
    startYmd: "2026-10-14",
    endYmd: "2026-10-21",
  });
});

test("insightsPreviousEqualYmdRange for month-length window", () => {
  const prev = insightsPreviousEqualYmdRange("2026-07-29", "2026-10-29");
  assert.equal(prev.endYmd, "2026-07-28");
  // Jul 29–Oct 29 spanDays=92 → previous start Jul 28 − 92 = Apr 27
  assert.equal(prev.startYmd, "2026-04-27");
});

test("insightsPercentChange signs and baseline", () => {
  assert.equal(insightsPercentChange(110, 100), 10);
  assert.equal(insightsPercentChange(70, 100), -30);
  assert.equal(insightsPercentChange(0, 0), 0);
  assert.equal(insightsPercentChange(5, 0), null);
});

test("formatInsightsTrendPercent", () => {
  assert.equal(formatInsightsTrendPercent(10), "+10%");
  assert.equal(formatInsightsTrendPercent(-30), "-30%");
  assert.equal(formatInsightsTrendPercent(0), "0%");
});
