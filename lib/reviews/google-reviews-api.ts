import "server-only";

import {
  getGoogleBusinessAccessTokenForRestaurant,
  googleReviewsParentPath,
} from "@/lib/integrations/google-business-access";

import type { UnifiedReview } from "@/lib/reviews/unified-review";

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

export async function fetchGoogleReviewsForRestaurant(
  restaurantId: string,
): Promise<{ reviews: UnifiedReview[] } | { error: string }> {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) return auth;

  const parent = googleReviewsParentPath(auth.config);
  if (!parent) return { error: "google_location_missing" };

  const url = `https://mybusiness.googleapis.com/v4/${parent}/reviews`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });
  const body = (await res.json()) as {
    reviews?: GoogleReviewRaw[];
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      error: body.error?.message ?? `google_reviews_${res.status}`,
    };
  }

  const reviews: UnifiedReview[] = (body.reviews ?? []).map((r, i) => {
    const stars = r.starRating ? (STAR_MAP[r.starRating] ?? 0) : 0;
    return {
      id: r.name ?? r.reviewId ?? `google-${i}`,
      platform: "google" as const,
      rating: stars,
      comment: r.comment?.trim() || null,
      authorName: r.reviewer?.displayName?.trim() || null,
      createdAt: r.createTime ?? r.updateTime ?? new Date().toISOString(),
      reply: r.reviewReply?.comment?.trim() || null,
      canReply: true,
      externalUrl: null,
    };
  });

  return { reviews };
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
