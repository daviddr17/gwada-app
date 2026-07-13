import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayKey,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@/lib/reservations/month-range";

export type InsightsPeriodDays = 7 | 30 | 90;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function ymdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function insightsPresetRangeYmd(days: InsightsPeriodDays): {
  startYmd: string;
  endYmd: string;
} {
  const periodEnd = startOfLocalDay(new Date());
  const periodStart = startOfLocalDay(new Date());
  periodStart.setDate(periodStart.getDate() - days);
  return {
    startYmd: localDayKey(periodStart),
    endYmd: localDayKey(periodEnd),
  };
}

export function insightsRangeFromYmd(
  startYmd: string,
  endYmd: string,
): {
  periodStartYmd: string;
  periodEndYmd: string;
  rangeStartIso: string;
  rangeEndIso: string;
} | null {
  if (!YMD_RE.test(startYmd) || !YMD_RE.test(endYmd)) return null;
  if (startYmd > endYmd) return null;

  const periodStart = startOfLocalDay(ymdToLocalDate(startYmd));
  const periodEnd = startOfLocalDay(ymdToLocalDate(endYmd));
  return {
    periodStartYmd: startYmd,
    periodEndYmd: endYmd,
    rangeStartIso: localDayStartToUtcIso(periodStart),
    rangeEndIso: exclusiveUtcIsoAfterLocalVisibleEnd(periodEnd),
  };
}

export function insightsRangeFromDays(days: InsightsPeriodDays) {
  const { startYmd, endYmd } = insightsPresetRangeYmd(days);
  return insightsRangeFromYmd(startYmd, endYmd)!;
}

export type InsightsFetchRangeParams =
  | { periodDays: InsightsPeriodDays }
  | { startYmd: string; endYmd: string };

export function resolveInsightsRange(
  params: InsightsFetchRangeParams,
): ReturnType<typeof insightsRangeFromYmd> | null {
  if ("periodDays" in params) {
    return insightsRangeFromDays(params.periodDays);
  }
  return insightsRangeFromYmd(params.startYmd, params.endYmd);
}

export function parseInsightsPeriodDays(raw: string | null): InsightsPeriodDays {
  const n = Number.parseInt(raw ?? "30", 10);
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}
