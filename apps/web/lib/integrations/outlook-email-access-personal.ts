import "server-only";

import {
  getOutlookOAuthPlatformConfigAdmin,
  outlookConfigFromJson,
  refreshOutlookAccessToken,
  type OutlookIntegrationConfig,
} from "@/lib/integrations/outlook-oauth";
export { outlookCredentialsFromAccess } from "@/lib/integrations/outlook-email-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getOutlookAccessTokenForUser(params: {
  restaurantId: string;
  userId: string;
}): Promise<
  | {
      accessToken: string;
      config: OutlookIntegrationConfig;
    }
  | { error: string }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };

  const { data, error } = await admin
    .from("user_restaurant_email_integrations")
    .select("status, config")
    .eq("restaurant_id", params.restaurantId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error || !data || data.status !== "outlook") {
    return { error: "outlook_not_connected" };
  }

  const cfg = outlookConfigFromJson(data.config);
  let accessToken = cfg.access_token?.trim() || undefined;
  const refreshToken = cfg.refresh_token?.trim();

  if (!accessToken && !refreshToken) {
    return { error: "outlook_token_missing" };
  }

  if (refreshToken) {
    const platform = await getOutlookOAuthPlatformConfigAdmin();
    if (platform) {
      const refreshed = await refreshOutlookAccessToken({
        clientId: platform.clientId,
        clientSecret: platform.clientSecret,
        refreshToken,
      });
      if (!("error" in refreshed)) {
        accessToken = refreshed.accessToken;
        await admin
          .from("user_restaurant_email_integrations")
          .update({
            config: {
              ...cfg,
              access_token: accessToken,
            },
          })
          .eq("restaurant_id", params.restaurantId)
          .eq("user_id", params.userId);
      } else if (!accessToken) {
        return { error: refreshed.error };
      }
    } else if (!accessToken) {
      return { error: "platform_not_configured" };
    }
  }

  if (!accessToken) {
    return { error: "outlook_token_missing" };
  }

  return { accessToken, config: cfg };
}
