import "server-only";

import {
  GMAIL_IMAP_HOST,
  GMAIL_IMAP_PORT,
  GMAIL_SMTP_HOST,
  GMAIL_SMTP_PORT,
  gmailConfigFromJson,
  getGmailOAuthPlatformConfigAdmin,
  refreshGmailAccessToken,
  type GmailIntegrationConfig,
} from "@/lib/integrations/gmail-oauth";
import type { EmailSmtpCredentials } from "@/lib/email/email-delivery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getGmailAccessTokenForRestaurant(
  restaurantId: string,
): Promise<
  | {
      accessToken: string;
      config: GmailIntegrationConfig;
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
    return { error: "gmail_token_missing" };
  }

  return { accessToken, config: cfg };
}

export function gmailCredentialsFromAccess(
  email: string,
  accessToken: string,
): EmailSmtpCredentials {
  return {
    email,
    password: "",
    smtpHost: GMAIL_SMTP_HOST,
    smtpPort: GMAIL_SMTP_PORT,
    imapHost: GMAIL_IMAP_HOST,
    imapPort: GMAIL_IMAP_PORT,
    oauthAccessToken: accessToken,
  };
}
