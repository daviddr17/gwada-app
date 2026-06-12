import "server-only";

import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { fetchRestaurantOAuthIntegration } from "@/lib/supabase/restaurant-oauth-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MetaInboxAuth = {
  platform: "facebook" | "instagram";
  pageId: string;
  pageAccessToken: string;
  igUserId?: string;
};

export async function resolveMetaInboxAuth(
  sb: SupabaseClient,
  restaurantId: string,
  platform: "facebook" | "instagram",
): Promise<MetaInboxAuth | null> {
  const row = await fetchRestaurantOAuthIntegration(
    sb,
    restaurantId,
    platform,
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") return null;

  const cfg = oauthConfigFromJson<MetaOAuthIntegrationConfig>(row.config);
  const pageAccessToken = cfg.page_access_token?.trim();
  const pageId = cfg.page_id?.trim();
  if (!pageAccessToken || !pageId) return null;

  if (platform === "instagram") {
    const igUserId = cfg.instagram_business_account_id?.trim();
    if (!igUserId) return null;
    return { platform, pageId, pageAccessToken, igUserId };
  }

  return { platform, pageId, pageAccessToken };
}

export async function isMetaInboxConnected(
  sb: SupabaseClient,
  restaurantId: string,
  platform: "facebook" | "instagram",
): Promise<boolean> {
  return (await resolveMetaInboxAuth(sb, restaurantId, platform)) != null;
}
