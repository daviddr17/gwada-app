import "server-only";

import { oauthConfigFromJson } from "@/lib/integrations/oauth-integration-types";
import type { ReviewsCacheablePlatform } from "@/lib/reviews/reviews-cache-constants";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

export async function isReviewsPlatformConnected(
  restaurantId: string,
  platform: ReviewsCacheablePlatform,
): Promise<boolean> {
  const oauthKey = platform === "google" ? "google_business" : "facebook";
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    oauthKey,
    (raw) => oauthConfigFromJson(raw),
  );
  return row?.status === "working";
}
