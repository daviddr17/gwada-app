import "server-only";

import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import {
  averageRating,
  medianRating,
  ratingDistribution,
} from "@/lib/reviews/review-stats";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicEmbedReview = {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string | null;
  createdAt: string;
};

export type PublicEmbedReviews = {
  restaurantId: string;
  name: string;
  slug: string;
  accentHex: string;
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

  const { data: reviewRows, error: reviewsError } = await admin
    .from("gwada_reviews")
    .select("id, rating, comment, guest_display_name, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(PUBLIC_REVIEW_LIMIT);

  if (reviewsError) {
    return { data: null, error: "db_error", status: 500 };
  }

  const reviews: PublicEmbedReview[] = (reviewRows ?? []).map((r) => {
    const raw = r as {
      id: string;
      rating: number;
      comment: string | null;
      guest_display_name: string | null;
      created_at: string;
    };
    const name = raw.guest_display_name?.trim() || null;
    return {
      id: raw.id,
      rating: Number(raw.rating),
      comment: raw.comment?.trim() || null,
      authorName: name,
      createdAt: raw.created_at,
    };
  });

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
      reviews,
      summary,
    },
    error: null,
  };
}
