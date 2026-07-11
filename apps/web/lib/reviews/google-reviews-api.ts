import "server-only";

import {
  getGoogleBusinessAccessTokenForRestaurant,
  googleReviewsParentPath,
} from "@/lib/integrations/google-business-access";

import {
  GOOGLE_REVIEWS_PAGE_SIZE,
  type GoogleReviewsPaginationMeta,
} from "@/lib/reviews/google-reviews-pagination";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { formatReviewCommentDisplay } from "@/lib/reviews/format-review-comment";

type GoogleReviewRaw = {
  name?: string;
  reviewId?: string;
  reviewer?: { displayName?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string };
};

const STAR_MAP: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

function mapGoogleReviewRaw(
  reviews: GoogleReviewRaw[] | undefined,
): UnifiedReview[] {
  return (reviews ?? []).map((r, i) => {
    const stars = r.starRating ? (STAR_MAP[r.starRating] ?? 0) : 0;
    return {
      id: r.name ?? r.reviewId ?? `google-${i}`,
      platform: "google" as const,
      rating: stars,
      comment: formatReviewCommentDisplay(r.comment?.trim() || null),
      authorName: r.reviewer?.displayName?.trim() || null,
      createdAt: r.createTime ?? r.updateTime ?? new Date().toISOString(),
      reply: r.reviewReply?.comment?.trim() || null,
      canReply: true,
      externalUrl: null,
    };
  });
}

/** Standort-Aggregate von Google (kommen bei jedem reviews.list mit, auch bei pageSize=1). */
export async function fetchGoogleReviewsLocationStats(
  restaurantId: string,
): Promise<
  | Pick<GoogleReviewsPaginationMeta, "averageRating" | "totalReviewCount">
  | { error: string }
> {
  const result = await fetchGoogleReviewsForRestaurant(restaurantId, {
    pageToken: null,
    pageSize: 1,
  });
  if ("error" in result) return result;
  return {
    averageRating: result.pagination.averageRating,
    totalReviewCount: result.pagination.totalReviewCount,
  };
}

export async function fetchGoogleReviewsForRestaurant(
  restaurantId: string,
  options?: { pageToken?: string | null; pageSize?: number },
): Promise<
  | {
      reviews: UnifiedReview[];
      pagination: GoogleReviewsPaginationMeta;
    }
  | { error: string }
> {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) return auth;

  const parent = googleReviewsParentPath(auth.config);
  if (!parent) return { error: "google_location_missing" };

  const pageSize = Math.min(
    50,
    Math.max(1, options?.pageSize ?? GOOGLE_REVIEWS_PAGE_SIZE),
  );
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    orderBy: "updateTime desc",
  });
  const pageToken = options?.pageToken?.trim();
  if (pageToken) params.set("pageToken", pageToken);

  const url = `https://mybusiness.googleapis.com/v4/${parent}/reviews?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });
  const body = (await res.json()) as {
    reviews?: GoogleReviewRaw[];
    averageRating?: number;
    totalReviewCount?: number;
    nextPageToken?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      error: body.error?.message ?? `google_reviews_${res.status}`,
    };
  }

  return {
    reviews: mapGoogleReviewRaw(body.reviews),
    pagination: {
      pageSize,
      totalReviewCount: Number(body.totalReviewCount ?? 0),
      nextPageToken: body.nextPageToken?.trim() || null,
      averageRating:
        typeof body.averageRating === "number" ? body.averageRating : null,
    },
  };
}

export async function replyToGoogleReview(params: {
  restaurantId: string;
  reviewName: string;
  comment: string;
}): Promise<{ ok: true } | { error: string }> {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(params.restaurantId);
  if ("error" in auth) return auth;

  const reviewName = params.reviewName.trim();
  if (!reviewName) return { error: "invalid_review" };

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: params.comment.trim() }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    return { error: body.error?.message ?? `google_reply_${res.status}` };
  }

  return { ok: true };
}
