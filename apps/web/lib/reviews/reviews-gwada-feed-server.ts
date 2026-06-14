import "server-only";

import { enrichGwadaReviewsWithContactIds } from "@/lib/reviews/contact-gwada-review-server";
import type { UnifiedReview } from "@/lib/reviews/unified-review";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const GWADA_FEED_LIMIT = 200;

export async function countGwadaReviews(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const { count, error } = await sb
    .from("gwada_reviews")
    .select("*", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  if (error) {
    console.warn("[gwada] gwada reviews count", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function loadGwadaReviewsForFeed(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<UnifiedReview[]> {
  const { data, error } = await sb
    .from("gwada_reviews")
    .select(
      "id, rating, comment, guest_display_name, created_at, reservation_id, invitation_id",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(GWADA_FEED_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const admin = createSupabaseAdminClient();
  const reservationIds = [
    ...new Set(
      rows
        .map((r) => r.reservation_id as string | null)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  const reservationNumberById = new Map<string, number>();
  if (reservationIds.length > 0) {
    const { data: reservationRows } = await sb
      .from("reservations")
      .select("id, reservation_number")
      .eq("restaurant_id", restaurantId)
      .in("id", reservationIds);
    for (const row of reservationRows ?? []) {
      reservationNumberById.set(
        row.id as string,
        Number(row.reservation_number),
      );
    }
  }
  const contactByReviewId =
    admin && rows.length > 0
      ? await enrichGwadaReviewsWithContactIds(
          admin,
          restaurantId,
          rows.map((r) => ({
            id: r.id as string,
            reservation_id: (r.reservation_id as string | null) ?? null,
            invitation_id: r.invitation_id as string,
          })),
        )
      : new Map<string, string>();

  return rows.map((r) => {
    const reservationId = (r.reservation_id as string | null) ?? null;
    return {
      id: r.id as string,
      platform: "gwada" as const,
      rating: Number(r.rating),
      comment: (r.comment as string | null) ?? null,
      authorName: (r.guest_display_name as string | null) ?? null,
      createdAt: r.created_at as string,
      reply: null,
      canReply: false,
      externalUrl: null,
      contactId: contactByReviewId.get(r.id as string) ?? null,
      reservationId,
      reservationNumber: reservationId
        ? (reservationNumberById.get(reservationId) ?? null)
        : null,
    };
  });
}
