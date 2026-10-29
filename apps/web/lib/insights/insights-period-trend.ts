/** Local calendar helpers (same semantics as `@gwada/shared` day keys). */

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localDayStartToUtcIso(localMidnight: Date): string {
  return localMidnight.toISOString();
}

function exclusiveUtcIsoAfterLocalVisibleEnd(localEndOfDay: Date): string {
  const next = startOfLocalDay(localEndOfDay);
  next.setDate(next.getDate() + 1);
  return next.toISOString();
}

/**
 * Immediately preceding window with the same inclusive day span
 * as `[startYmd, endYmd]` (local calendar days).
 */
export function insightsPreviousEqualYmdRange(
  startYmd: string,
  endYmd: string,
): { startYmd: string; endYmd: string } {
  const start = startOfLocalDay(ymdToLocalDate(startYmd));
  const end = startOfLocalDay(ymdToLocalDate(endYmd));
  const spanDays = Math.round(
    (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  const prevEnd = startOfLocalDay(new Date(start));
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = startOfLocalDay(new Date(prevEnd));
  prevStart.setDate(prevStart.getDate() - spanDays);
  return {
    startYmd: localDayKey(prevStart),
    endYmd: localDayKey(prevEnd),
  };
}

export function insightsRangeIsoFromYmd(
  startYmd: string,
  endYmd: string,
): {
  periodStart: Date;
  periodEnd: Date;
  rangeStartIso: string;
  rangeEndIso: string;
} {
  const periodStart = startOfLocalDay(ymdToLocalDate(startYmd));
  const periodEnd = startOfLocalDay(ymdToLocalDate(endYmd));
  periodEnd.setHours(23, 59, 59, 999);
  return {
    periodStart,
    periodEnd,
    rangeStartIso: localDayStartToUtcIso(periodStart),
    rangeEndIso: exclusiveUtcIsoAfterLocalVisibleEnd(periodEnd),
  };
}

/**
 * Percent change vs previous equal period.
 * `null` when previous is 0 and current is not (no meaningful baseline).
 */
export function insightsPercentChange(
  current: number,
  previous: number,
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

/** Compact signed label, e.g. `+10%`, `-30%`, `0%`. */
export function formatInsightsTrendPercent(percent: number): string {
  if (percent > 0) return `+${percent}%`;
  return `${percent}%`;
}
