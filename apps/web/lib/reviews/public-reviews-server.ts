import "server-only";

import { unstable_cache } from "next/cache";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { oauthConfigFromJson } from "@/lib/integrations/oauth-integration-types";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import {
  averageRating,
  medianRating,
  ratingDistribution,
} from "@/lib/reviews/review-stats";
import { readReviewsFeedFromCache } from "@/lib/reviews/reviews-feed-read-server";
import { triggerReviewsFeedSyncIfStale } from "@/lib/reviews/reviews-feed-sync-server";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicEmbedReview = {
  id: string;
  platform: ReviewPlatform;
  rating: number;
  comment: string | null;
  authorName: string | null;
  createdAt: string;
  reply: string | null;
};

export type PublicEmbedReviews = {
  restaurantId: string;
  name: string;
  slug: string;
  accentHex: string;
  connectedPlatforms: ReviewPlatform[];
  reviews: PublicEmbedReview[];
  summary: {
    count: number;
    average: number | null;
    median: number | null;
    distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  };
};

const PUBLIC_REVIEW_LIMIT = 100;

function adminOrError(): SupabaseClient | { error: string; status: number } {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured", status: 503 };
  return admin;
}

function toPublicReview(review: UnifiedReview): PublicEmbedReview {
  return {
    id: review.id,
    platform: review.platform,
    rating: review.rating,
    comment: review.comment,
    authorName: review.authorName,
    createdAt: review.createdAt,
    reply: review.reply,
  };
}

async function loadConnectedPlatformReviewsUncached(
  restaurantId: string,
): Promise<{ reviews: UnifiedReview[]; connectedPlatforms: ReviewPlatform[] }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { reviews: [], connectedPlatforms: ["gwada"] };
  }

  const { data: reviewRows } = await admin
    .from("gwada_reviews")
    .select("id, rating, comment, guest_display_name, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(PUBLIC_REVIEW_LIMIT);

  const gwadaReviews: UnifiedReview[] = (reviewRows ?? []).map((r) => {
    const raw = r as {
      id: string;
      rating: number;
      comment: string | null;
      guest_display_name: string | null;
      created_at: string;
    };
    return {
      id: raw.id,
      platform: "gwada" as const,
      rating: Number(raw.rating),
      comment: raw.comment?.trim() || null,
      authorName: raw.guest_display_name?.trim() || null,
      createdAt: raw.created_at,
      reply: null,
      canReply: false,
      externalUrl: null,
    };
  });

  const [googleIntegration, facebookIntegration, cachedFeed] = await Promise.all([
    fetchRestaurantOAuthIntegrationAdmin(restaurantId, "google_business", (raw) =>
      oauthConfigFromJson(raw),
    ),
    fetchRestaurantOAuthIntegrationAdmin(restaurantId, "facebook", (raw) =>
      oauthConfigFromJson(raw),
    ),
    readReviewsFeedFromCache(restaurantId, admin, ["google", "facebook"]),
  ]);

  void triggerReviewsFeedSyncIfStale(restaurantId, ["google", "facebook"]);

  const googleConnected = googleIntegration?.status === "working";
  const facebookConnected = facebookIntegration?.status === "working";

  const googleReviews = cachedFeed.reviews.filter((r) => r.platform === "google");
  const facebookReviews = cachedFeed.reviews.filter(
    (r) => r.platform === "facebook",
  );

  const googleOk =
    googleConnected &&
    (googleReviews.length > 0 || !cachedFeed.sync.platformErrors.google);
  const facebookOk =
    facebookConnected &&
    (facebookReviews.length > 0 || !cachedFeed.sync.platformErrors.facebook);

  const connectedPlatforms: ReviewPlatform[] = ["gwada"];
  if (googleOk) connectedPlatforms.push("google");
  if (facebookOk) connectedPlatforms.push("facebook");

  const reviews = [...gwadaReviews, ...googleReviews, ...facebookReviews].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return { reviews, connectedPlatforms };
}

const loadConnectedPlatformReviews = (restaurantId: string) =>
  unstable_cache(
    async () => loadConnectedPlatformReviewsUncached(restaurantId),
    ["public-platform-reviews", restaurantId],
    { revalidate: 60 },
  )();

export async function fetchPublicEmbedReviews(
  slugInput: string,
): Promise<
  | { data: PublicEmbedReviews; error: null }
  | { data: null; error: string; status: number }
> {
  const admin = adminOrError();
  if ("error" in admin) {
    return { data: null, error: admin.error, status: admin.status };
  }

  const slug = normalizeRestaurantSlugInput(slugInput);
  if (!slug) {
    return { data: null, error: "invalid_slug", status: 400 };
  }

  const { data: row, error } = await admin
    .from("restaurants")
    .select("id, name, slug, brand_accent_hex, is_published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { data: null, error: "db_error", status: 500 };
  }
  if (!row?.id || !row.is_published) {
    return { data: null, error: "not_found", status: 404 };
  }

  const restaurantId = row.id as string;

  const { reviews: unifiedReviews, connectedPlatforms } =
    await loadConnectedPlatformReviews(restaurantId);

  const reviews = unifiedReviews.map(toPublicReview);

  const summary = {
    count: reviews.length,
    average: averageRating(reviews),
    median: medianRating(reviews),
    distribution: ratingDistribution(reviews),
  };

  return {
    data: {
      restaurantId,
      name: row.name as string,
      slug: row.slug as string,
      accentHex:
        normalizeHex((row.brand_accent_hex as string | null) ?? "") ??
        DEFAULT_ACCENT_HEX,
      connectedPlatforms,
      reviews,
      summary,
    },
    error: null,
  };
}
