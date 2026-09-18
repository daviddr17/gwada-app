import "server-only";

import { GOOGLE_BUSINESS_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import { clearGoogleInsightsQuotaCooldown } from "@/lib/insights/platform-insights-response-cache";
import type { GoogleBusinessLocationOption } from "@/lib/integrations/google-oauth-pending";
import { googleBusinessConfigFromJson } from "@/lib/integrations/google-business-oauth";
import type { GoogleBusinessIntegrationConfig } from "@/lib/integrations/oauth-integration-types";
import { upsertRestaurantOAuthIntegration } from "@/lib/supabase/restaurant-oauth-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

function mergeGoogleConfig(
  existing: GoogleBusinessIntegrationConfig,
  patch: GoogleBusinessIntegrationConfig | undefined,
): GoogleBusinessIntegrationConfig {
  return { ...existing, ...patch };
}

export async function finalizeGoogleBusinessIntegration(
  admin: SupabaseClient,
  restaurantId: string,
  location: GoogleBusinessLocationOption,
  tokens: {
    accessToken: string;
    refreshToken: string | null;
    grantedScopes: string[];
  },
): Promise<{ error: string | null }> {
  const displayName =
    location.locationTitle?.trim() ||
    location.accountTitle?.trim() ||
    "Google Business";
  const now = new Date().toISOString();
  clearGoogleInsightsQuotaCooldown(restaurantId);

  const saved = await upsertRestaurantOAuthIntegration(
    admin,
    restaurantId,
    "google_business",
    {
      status: "working",
      display_name: displayName,
      connected_at: now,
      last_error: null,
      config: {
        requested_scopes: [...GOOGLE_BUSINESS_OAUTH_SCOPE_IDS],
        granted_scopes: tokens.grantedScopes,
        scopes_checked_at: now,
        account_name: location.accountName,
        account_title: location.accountTitle,
        location_name: location.locationName,
        location_title: location.locationTitle,
        refresh_token: tokens.refreshToken ?? undefined,
        access_token: tokens.accessToken,
      },
    },
    googleBusinessConfigFromJson,
    mergeGoogleConfig,
  );
  if (saved.error) return saved;

  await Promise.all([
    admin
      .from("restaurant_reviews_platform_sync")
      .update({ last_error: null, synced_at: null })
      .eq("restaurant_id", restaurantId)
      .eq("platform", "google"),
    admin
      .from("restaurant_gallery_platform_sync")
      .update({ last_error: null, synced_at: null })
      .eq("restaurant_id", restaurantId)
      .eq("platform", "google_business"),
    admin
      .from("restaurant_news_platform_sync")
      .update({ last_error: null, synced_at: null })
      .eq("restaurant_id", restaurantId)
      .eq("platform", "google_business"),
  ]);

  return saved;
}
