import { OUTLOOK_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import { syncInboxHistoryOnConnect } from "@/lib/contacts/sync-inbox-history-on-connect-server";
import { isRestaurantEmailMailboxStatus } from "@/lib/email/restaurant-email-mailbox";
import {
  buildOutlookMailboxConfig,
  decodeOutlookOAuthState,
  exchangeOutlookOAuthCode,
  fetchOutlookAccountEmail,
  getOutlookOAuthPlatformConfigAdmin,
  outlookConfigFromJson,
  outlookOAuthCallbackUrl,
} from "@/lib/integrations/outlook-oauth";
import { parseGoogleGrantedScopes } from "@/lib/integrations/google-business-oauth";
import { redirectToSettingsIntegrations } from "@/lib/integrations/meta-oauth-shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantEmailSmtpConfig } from "@/lib/supabase/restaurant-email-integration-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();
  const stateRaw = searchParams.get("state")?.trim();
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: String(oauthError).slice(0, 200),
    });
  }

  if (!code || !stateRaw) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: "missing_code",
    });
  }

  const state = decodeOutlookOAuthState(stateRaw);
  if (!state) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: "invalid_state",
    });
  }

  const platformCfg = await getOutlookOAuthPlatformConfigAdmin();
  if (!platformCfg) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: "platform_not_configured",
    });
  }

  const redirectUri = outlookOAuthCallbackUrl(req);
  const tokenResult = await exchangeOutlookOAuthCode({
    clientId: platformCfg.clientId,
    clientSecret: platformCfg.clientSecret,
    redirectUri,
    code,
  });

  if ("error" in tokenResult) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: tokenResult.error,
    });
  }

  const emailResult = await fetchOutlookAccountEmail({
    accessToken: tokenResult.accessToken,
  });
  if ("error" in emailResult) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: emailResult.error,
    });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: "server_misconfigured",
    });
  }

  const existing = await fetchRestaurantEmailSmtpConfig(
    admin,
    state.restaurantId,
  );
  const existingCfg = outlookConfigFromJson(existing?.config ?? {});
  const grantedScopes = parseGoogleGrantedScopes(tokenResult.scope);

  const config = buildOutlookMailboxConfig({
    email: emailResult.email,
    fromName: existingCfg.from_name,
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    grantedScopes:
      grantedScopes.length > 0 ? grantedScopes : [...OUTLOOK_OAUTH_SCOPE_IDS],
    existingRefreshToken: existingCfg.refresh_token,
  });

  if (!config.refresh_token) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: "outlook_refresh_token_missing",
    });
  }

  const { error } = await admin.from("restaurant_integrations").upsert(
    {
      restaurant_id: state.restaurantId,
      integration_key: "email",
      waha_session_name: "email",
      status: "outlook",
      phone_number: null,
      display_name: emailResult.email,
      connected_at: new Date().toISOString(),
      last_error: null,
      config,
    },
    { onConflict: "restaurant_id,integration_key" },
  );

  if (error) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: error.message,
    });
  }

  if (!isRestaurantEmailMailboxStatus(existing?.status)) {
    void syncInboxHistoryOnConnect(admin, {
      restaurantId: state.restaurantId,
      email: true,
    }).catch((e) => {
      console.warn("[contact-inbox] history-on-connect outlook", e);
    });
  }

  return redirectToSettingsIntegrations(req, {
    provider: "email",
    result: "connected",
  });
}
