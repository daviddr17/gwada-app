import "server-only";

import {
  getGoogleBusinessPlatformConfigAdmin,
  googleBusinessConfigFromJson,
  refreshGoogleBusinessAccessToken,
} from "@/lib/integrations/google-business-oauth";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import type { GoogleBusinessIntegrationConfig } from "@/lib/integrations/oauth-integration-types";

export async function getGoogleBusinessAccessTokenForRestaurant(
  restaurantId: string,
): Promise<
  | {
      accessToken: string;
      config: GoogleBusinessIntegrationConfig;
    }
  | { error: string }
> {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "google_business",
    googleBusinessConfigFromJson,
  );
  if (!row || row.status !== "working") {
    return { error: "google_not_connected" };
  }

  const cfg = row.config;
  let accessToken = cfg.access_token?.trim();
  const refreshToken = cfg.refresh_token?.trim();

  if (!accessToken && !refreshToken) {
    return { error: "google_token_missing" };
  }

  if (refreshToken) {
    const platform = await getGoogleBusinessPlatformConfigAdmin();
    if (!platform) return { error: "platform_not_configured" };
    const refreshed = await refreshGoogleBusinessAccessToken({
      clientId: platform.clientId,
      clientSecret: platform.clientSecret,
      refreshToken,
    });
    if ("error" in refreshed) {
      return { error: refreshed.error };
    }
    accessToken = refreshed.accessToken;
  }

  if (!accessToken) {
    return { error: "google_token_missing" };
  }

  return { accessToken, config: cfg };
}

export function googleReviewsParentPath(
  config: GoogleBusinessIntegrationConfig,
): string | null {
  const account = config.account_name?.trim();
  const location = config.location_name?.trim();
  if (!account || !location) return null;
  if (location.startsWith("accounts/")) return location;
  return `${account}/${location}`;
}
