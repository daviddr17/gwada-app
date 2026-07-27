import "server-only";

import {
  OUTLOOK_IMAP_HOST,
  OUTLOOK_IMAP_PORT,
  OUTLOOK_SMTP_HOST,
  OUTLOOK_SMTP_PORT,
  getOutlookOAuthPlatformConfigAdmin,
  outlookConfigFromJson,
  refreshOutlookAccessToken,
  type OutlookIntegrationConfig,
} from "@/lib/integrations/outlook-oauth";
import type { EmailSmtpCredentials } from "@/lib/email/email-delivery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getOutlookAccessTokenForRestaurant(
  restaurantId: string,
): Promise<
  | {
      accessToken: string;
      config: OutlookIntegrationConfig;
    }
  | { error: string }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };

  const { data, error } = await admin
    .from("restaurant_integrations")
    .select("status, config")
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", "email")
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
          .from("restaurant_integrations")
          .update({
            config: {
              ...cfg,
              access_token: accessToken,
            },
          })
          .eq("restaurant_id", restaurantId)
          .eq("integration_key", "email");
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

export function outlookCredentialsFromAccess(
  email: string,
  accessToken: string,
): EmailSmtpCredentials {
  return {
    email,
    password: "",
    smtpHost: OUTLOOK_SMTP_HOST,
    smtpPort: OUTLOOK_SMTP_PORT,
    imapHost: OUTLOOK_IMAP_HOST,
    imapPort: OUTLOOK_IMAP_PORT,
    oauthAccessToken: accessToken,
  };
}
