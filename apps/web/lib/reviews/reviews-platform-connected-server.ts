import "server-only";

import { googleBusinessConfigFromJson } from "@/lib/integrations/google-business-oauth";
import { oauthConfigFromJson } from "@/lib/integrations/oauth-integration-types";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import type { ReviewsCacheablePlatform } from "@/lib/reviews/reviews-cache-constants";
import {
  fetchReviewPlatformMessagingFlags,
  isReviewPlatformEnabledBySuperadmin,
  isReviewPlatformVisibleInDashboard,
} from "@/lib/reviews/reviews-platform-availability-server";
import { fetchRestaurantFacebookIntegration } from "@/lib/supabase/restaurant-facebook-integration-db";
import { fetchRestaurantTripadvisorConfigAdmin } from "@/lib/supabase/restaurant-tripadvisor-integration-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

export type ReviewPlatformConnectionState = {
  googleConnected: boolean;
  facebookConnected: boolean;
  tripadvisorConnected: boolean;
  googleVisible: boolean;
  facebookVisible: boolean;
  tripadvisorVisible: boolean;
};

export async function loadReviewPlatformConnectionState(
  restaurantId: string,
): Promise<ReviewPlatformConnectionState> {
  const admin = createSupabaseAdminClient();
  const emptyFlags = {
    whatsappEnabled: false,
    emailEnabled: false,
    facebookEnabled: false,
    instagramEnabled: false,
    googleBusinessEnabled: false,
    lexofficeEnabled: false,
    tripadvisorEnabled: false,
    appleBusinessConnectEnabled: false,
  };

  const [flags, googleRow, facebookRow, tripadvisorRow] = await Promise.all([
    admin ? fetchReviewPlatformMessagingFlags(admin) : Promise.resolve(emptyFlags),
    fetchRestaurantOAuthIntegrationAdmin(
      restaurantId,
      "google_business",
      googleBusinessConfigFromJson,
    ),
    admin
      ? fetchRestaurantFacebookIntegration(admin, restaurantId)
      : Promise.resolve(null),
    fetchRestaurantTripadvisorConfigAdmin(restaurantId),
  ]);

  const googleConnected = googleRow?.status === "working";
  const facebookConnected = facebookRow?.status === "working";
  const tripadvisorConnected = tripadvisorRow?.status === "working";

  return {
    googleConnected,
    facebookConnected,
    tripadvisorConnected,
    googleVisible: isReviewPlatformVisibleInDashboard("google", {
      flags,
      googleConnected,
      facebookConnected,
      tripadvisorConnected,
    }),
    facebookVisible: isReviewPlatformVisibleInDashboard("facebook", {
      flags,
      googleConnected,
      facebookConnected,
      tripadvisorConnected,
    }),
    tripadvisorVisible: isReviewPlatformVisibleInDashboard("tripadvisor", {
      flags,
      googleConnected,
      facebookConnected,
      tripadvisorConnected,
    }),
  };
}

export async function isReviewsPlatformConnected(
  restaurantId: string,
  platform: ReviewsCacheablePlatform,
): Promise<boolean> {
  if (platform === "tripadvisor") {
    const row = await fetchRestaurantTripadvisorConfigAdmin(restaurantId);
    return row?.status === "working";
  }
  const oauthKey = platform === "google" ? "google_business" : "facebook";
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    oauthKey,
    (raw) => oauthConfigFromJson(raw),
  );
  return row?.status === "working";
}

/** Superadmin aktiv + Restaurant verbunden — für Chips, Feed und Sync. */
export async function isReviewsPlatformVisible(
  restaurantId: string,
  platform: ReviewPlatform,
): Promise<boolean> {
  if (platform === "gwada") return true;
  const state = await loadReviewPlatformConnectionState(restaurantId);
  if (platform === "google") return state.googleVisible;
  if (platform === "facebook") return state.facebookVisible;
  if (platform === "tripadvisor") return state.tripadvisorVisible;
  return false;
}

export function isReviewsCacheablePlatformEnabledBySuperadmin(
  platform: ReviewsCacheablePlatform,
  flags: Awaited<ReturnType<typeof fetchReviewPlatformMessagingFlags>>,
): boolean {
  return isReviewPlatformEnabledBySuperadmin(platform, flags);
}
