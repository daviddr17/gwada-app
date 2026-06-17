import type { ReviewStatsPeriod } from "@/lib/reviews/compute-review-statistics";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  startOfLocalDay,
} from "@/lib/reservations/month-range";

export function reviewStatisticsPeriodRange(monthsBack: ReviewStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
  rangeStartIso: string;
  rangeEndIso: string;
} {
  const periodEnd = startOfLocalDay(new Date());
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return {
    periodStart,
    periodEnd,
    rangeStartIso: periodStart.toISOString(),
    rangeEndIso: exclusiveUtcIsoAfterLocalVisibleEnd(periodEnd),
  };
}
