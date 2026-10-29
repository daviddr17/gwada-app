import "server-only";

import {
  gmailConfigFromJson,
  getGmailOAuthPlatformConfigAdmin,
  refreshGmailAccessToken,
  type GmailIntegrationConfig,
} from "@/lib/integrations/gmail-oauth";
export { gmailCredentialsFromAccess } from "@/lib/integrations/gmail-email-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getGmailAccessTokenForUser(params: {
  restaurantId: string;
  userId: string;
}): Promise<
  | {
      accessToken: string;
      config: GmailIntegrationConfig;
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

  if (error || !data || data.status !== "gmail") {
    return { error: "gmail_not_connected" };
  }

  const cfg = gmailConfigFromJson(data.config);
  let accessToken = cfg.access_token?.trim() || undefined;
  const refreshToken = cfg.refresh_token?.trim();

  if (!accessToken && !refreshToken) {
    return { error: "gmail_token_missing" };
  }

  if (refreshToken) {
    const platform = await getGmailOAuthPlatformConfigAdmin();
    if (platform) {
      const refreshed = await refreshGmailAccessToken({
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
    return { error: "gmail_token_missing" };
  }

  return { accessToken, config: cfg };
}
