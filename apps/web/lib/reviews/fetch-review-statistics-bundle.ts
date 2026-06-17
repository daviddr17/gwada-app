import type { ReviewStatsPeriod } from "@/lib/reviews/compute-review-statistics";
import type { ReviewStatisticsRevisionResponse } from "@/lib/reviews/reviews-statistics-revision";
import type { ReviewStatisticsBundle } from "@/lib/supabase/reviews-analytics-db";

export async function fetchReviewStatisticsRevision(params: {
  restaurantId: string;
  monthsBack?: ReviewStatsPeriod;
}): Promise<{
  data: ReviewStatisticsRevisionResponse | null;
  error: string | null;
}> {
  const qs = new URLSearchParams({ restaurantId: params.restaurantId });
  if (params.monthsBack != null) {
    qs.set("monthsBack", String(params.monthsBack));
  }

  const res = await fetch(`/api/reviews/statistics/revision?${qs.toString()}`);
  const body = (await res.json()) as ReviewStatisticsRevisionResponse & {
    error?: string;
  };

  if (!res.ok) {
    return {
      data: null,
      error: body.error ?? "Statistik-Stand konnte nicht geprüft werden.",
    };
  }

  return { data: body, error: null };
}

export async function fetchReviewStatisticsBundle(params: {
  restaurantId: string;
  monthsBack?: ReviewStatsPeriod;
}): Promise<{ data: ReviewStatisticsBundle | null; error: string | null }> {
  const qs = new URLSearchParams({ restaurantId: params.restaurantId });
  if (params.monthsBack != null) {
    qs.set("monthsBack", String(params.monthsBack));
  }

  const res = await fetch(`/api/reviews/statistics?${qs.toString()}`);
  const body = (await res.json()) as ReviewStatisticsBundle & { error?: string };

  if (!res.ok) {
    return {
      data: null,
      error: body.error ?? "Statistiken konnten nicht geladen werden.",
    };
  }

  return { data: body, error: null };
}
