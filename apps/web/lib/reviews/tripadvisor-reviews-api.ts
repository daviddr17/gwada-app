import "server-only";

import {
  ensureTripadvisorAllowlistLocation,
  fetchTripadvisorApi,
  getTripadvisorLocationIdForRestaurant,
  TRIPADVISOR_DEFAULT_LANGUAGE,
} from "@/lib/integrations/tripadvisor-api-client";
import { terraLocalizedText } from "@/lib/integrations/tripadvisor-terra-parse";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { formatReviewCommentDisplay } from "@/lib/reviews/format-review-comment";

type TripadvisorReviewUser = {
  username?: string;
};

type TripadvisorReviewRaw = {
  id?: number | string;
  rating?: number;
  title?: string | { language?: string; value?: string; primary?: boolean }[];
  text?: string | { language?: string; value?: string; primary?: boolean }[];
  published_date?: string;
  publish_ts?: string;
  url?: string;
  user?: TripadvisorReviewUser;
};

type TripadvisorReviewsResponse = {
  data?: TripadvisorReviewRaw[];
  meta?: {
    total_count?: number;
  };
  pagination?: {
    total_elements?: number;
  };
};

const TRIPADVISOR_REVIEWS_PAGE_SIZE = 50;
const TRIPADVISOR_REVIEWS_MAX_PAGES = 5;

function reviewLocalizedText(
  value: TripadvisorReviewRaw["title"],
): string {
  if (typeof value === "string") return value.trim();
  return terraLocalizedText(value) ?? "";
}

function mapTripadvisorReview(raw: TripadvisorReviewRaw): UnifiedReview | null {
  const id = raw.id != null ? String(raw.id) : "";
  if (!id) return null;

  const title = reviewLocalizedText(raw.title);
  const text = reviewLocalizedText(raw.text);
  const commentBody = [title, text].filter(Boolean).join(title && text ? "\n\n" : "");

  return {
    id: `tripadvisor-${id}`,
    platform: "tripadvisor" as const,
    rating: typeof raw.rating === "number" ? raw.rating : 0,
    comment: formatReviewCommentDisplay(commentBody || null),
    authorName: raw.user?.username?.trim() || null,
    createdAt: raw.publish_ts ?? raw.published_date ?? new Date().toISOString(),
    reply: null,
    canReply: false,
    externalUrl: raw.url?.trim() || null,
  };
}

export async function fetchTripadvisorReviewsForRestaurant(
  restaurantId: string,
): Promise<
  | { reviews: UnifiedReview[]; meta: { totalReviewCount?: number } }
  | { error: string }
> {
  const auth = await getTripadvisorLocationIdForRestaurant(restaurantId);
  if ("error" in auth) return auth;

  const allowlist = await ensureTripadvisorAllowlistLocation(auth.locationId);
  if ("error" in allowlist) return allowlist;

  const allReviews: UnifiedReview[] = [];
  let totalReviewCount: number | undefined;

  for (let page = 1; page <= TRIPADVISOR_REVIEWS_MAX_PAGES; page++) {
    const result = await fetchTripadvisorApi<TripadvisorReviewsResponse>({
      path: `/locations/${encodeURIComponent(auth.locationId)}/reviews`,
      searchParams: {
        page,
        size: TRIPADVISOR_REVIEWS_PAGE_SIZE,
        sort_by: "MOST_RECENT",
        language: TRIPADVISOR_DEFAULT_LANGUAGE,
      },
    });
    if ("error" in result) return result;

    const batch = (result.data.data ?? [])
      .map(mapTripadvisorReview)
      .filter((review): review is UnifiedReview => review !== null);
    allReviews.push(...batch);

    if (typeof result.data.pagination?.total_elements === "number") {
      totalReviewCount = result.data.pagination.total_elements;
    } else if (typeof result.data.meta?.total_count === "number") {
      totalReviewCount = result.data.meta.total_count;
    }

    if (batch.length < TRIPADVISOR_REVIEWS_PAGE_SIZE) break;
  }

  return {
    reviews: allReviews,
    meta: {
      totalReviewCount: totalReviewCount ?? allReviews.length,
    },
  };
}
