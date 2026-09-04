import "server-only";

import {
  getGoogleBusinessPlatformSecretsAdmin,
  googleBusinessConfigFromJson,
  refreshGoogleBusinessAccessToken,
} from "@/lib/integrations/google-business-oauth";
import { platformApiFetchSignal } from "@/lib/integrations/platform-api-timeout";
import type { GoogleBusinessIntegrationConfig } from "@/lib/integrations/oauth-integration-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchRestaurantOAuthIntegrationAdmin,
  upsertRestaurantOAuthIntegration,
} from "@/lib/supabase/restaurant-oauth-integration-db";

export function googleLocationResourceName(locationName: string): string {
  const trimmed = locationName.trim();
  if (trimmed.startsWith("locations/")) return trimmed;
  const match = /locations\/[^/]+/.exec(trimmed);
  return match?.[0] ?? trimmed;
}

async function persistGoogleAccessToken(
  restaurantId: string,
  accessToken: string,
  existing: { display_name: string | null; connected_at: string | null },
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await upsertRestaurantOAuthIntegration(
    admin,
    restaurantId,
    "google_business",
    {
      status: "working",
      display_name: existing.display_name,
      connected_at: existing.connected_at,
      config: { access_token: accessToken },
    },
    googleBusinessConfigFromJson,
    (prev, patch) => ({ ...prev, ...patch }),
  );
}

export async function getGoogleBusinessAccessTokenForRestaurant(
  restaurantId: string,
  options?: { forceRefresh?: boolean },
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
  let accessToken = cfg.access_token?.trim() || undefined;
  const refreshToken = cfg.refresh_token?.trim();

  if (!accessToken && !refreshToken) {
    return { error: "google_token_missing" };
  }

  const shouldRefresh = Boolean(options?.forceRefresh) || !accessToken;
  if (shouldRefresh && refreshToken) {
    const platform = await getGoogleBusinessPlatformSecretsAdmin();
    if (platform) {
      const refreshed = await refreshGoogleBusinessAccessToken({
        clientId: platform.clientId,
        clientSecret: platform.clientSecret,
        refreshToken,
      });
      if (!("error" in refreshed)) {
        accessToken = refreshed.accessToken;
        void persistGoogleAccessToken(restaurantId, refreshed.accessToken, {
          display_name: row.display_name,
          connected_at: row.connected_at,
        });
      } else if (!accessToken) {
        return { error: refreshed.error };
      }
    } else if (!accessToken) {
      return { error: "platform_not_configured" };
    }
  }

  if (!accessToken) {
    return { error: "google_token_missing" };
  }

  return { accessToken, config: cfg };
}

export async function fetchWithGoogleBusinessAuth(
  restaurantId: string,
  url: string,
  init: RequestInit = {},
): Promise<Response | { error: string }> {
  const run = async (forceRefresh: boolean) => {
    const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId, {
      forceRefresh,
    });
    if ("error" in auth) return auth;
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${auth.accessToken}`);
    const res = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      signal: init.signal ?? platformApiFetchSignal(),
    });
    return { res, auth };
  };

  try {
    const first = await run(false);
    if ("error" in first) return first;
    if (first.res.status !== 401) return first.res;

    const second = await run(true);
    if ("error" in second) return second;
    return second.res;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { error: "google_timeout" };
    }
    return { error: "google_fetch_failed" };
  }
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
