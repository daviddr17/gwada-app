import "server-only";

import { syncRestaurantGalleryPlatform } from "@/lib/gallery/gallery-feed-sync-server";
import { syncRestaurantReviewsPlatform } from "@/lib/reviews/reviews-feed-sync-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Nach erfolgreichem TripAdvisor-Connect Reviews + Galerie einmal syncen,
 * damit die Module nicht auf leeren stale Cache sitzen bleiben.
 */
export async function syncTripadvisorContentAfterConnect(
  restaurantId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  await Promise.allSettled([
    syncRestaurantReviewsPlatform(admin, restaurantId, "tripadvisor"),
    syncRestaurantGalleryPlatform(admin, restaurantId, "tripadvisor"),
  ]);
}
