import { GMAIL_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import { syncInboxHistoryOnConnect } from "@/lib/contacts/sync-inbox-history-on-connect-server";
import {
  parseSharedInboxAccess,
  sharedInboxAccessToConfigPatch,
} from "@/lib/email/shared-inbox-access";
import {
  buildGmailMailboxConfig,
  decodeGmailOAuthState,
  exchangeGmailOAuthCode,
  fetchGmailAccountEmail,
  getGmailOAuthPlatformConfigAdmin,
  gmailConfigFromJson,
  gmailOAuthCallbackUrl,
} from "@/lib/integrations/gmail-oauth";
import { parseGoogleGrantedScopes } from "@/lib/integrations/google-business-oauth";
import { redirectToSettingsIntegrations } from "@/lib/integrations/meta-oauth-shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantEmailSmtpConfig } from "@/lib/supabase/restaurant-email-integration-db";
import {
  fetchUserRestaurantEmailConfigAdmin,
  upsertUserRestaurantEmailIntegration,
} from "@/lib/supabase/user-restaurant-email-integration-db";
import { syncUserRestaurantEmailInbox } from "@/lib/contacts/sync-user-restaurant-email-inbox";

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

  const state = decodeGmailOAuthState(stateRaw);
  if (!state) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: "invalid_state",
    });
  }

  const platformCfg = await getGmailOAuthPlatformConfigAdmin();
  if (!platformCfg) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: "platform_not_configured",
    });
  }

  const redirectUri = gmailOAuthCallbackUrl(req);
  const tokenResult = await exchangeGmailOAuthCode({
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

  const emailResult = await fetchGmailAccountEmail({
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

  const grantedScopes = parseGoogleGrantedScopes(tokenResult.scope);

  if (state.purpose === "personal" && state.userId) {
    const existing = await fetchUserRestaurantEmailConfigAdmin(admin, {
      restaurantId: state.restaurantId,
      userId: state.userId,
    });
    const existingCfg = gmailConfigFromJson(existing?.config ?? {});
    const config = buildGmailMailboxConfig({
      email: emailResult.email,
      fromName: existingCfg.from_name,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      grantedScopes:
        grantedScopes.length > 0 ? grantedScopes : [...GMAIL_OAUTH_SCOPE_IDS],
      existingRefreshToken: existingCfg.refresh_token,
    });
    if (!config.refresh_token) {
      return redirectToSettingsIntegrations(req, {
        provider: "email",
        result: "error",
        message: "gmail_refresh_token_missing",
      });
    }
    const { error } = await upsertUserRestaurantEmailIntegration(admin, {
      restaurantId: state.restaurantId,
      userId: state.userId,
      status: "gmail",
      config,
    });
    if (error) {
      return redirectToSettingsIntegrations(req, {
        provider: "email",
        result: "error",
        message: error,
      });
    }
    void syncUserRestaurantEmailInbox(admin, {
      restaurantId: state.restaurantId,
      userId: state.userId,
    }).catch((e) => {
      console.warn("[contact-inbox] personal gmail sync", e);
    });
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "connected",
      message: "personal",
    });
  }

  const existing = await fetchRestaurantEmailSmtpConfig(
    admin,
    state.restaurantId,
  );
  const existingCfg = gmailConfigFromJson(existing?.config ?? {});
  const sharedPatch = sharedInboxAccessToConfigPatch(
    parseSharedInboxAccess(existing?.config ?? {}),
  );
  const config = {
    ...buildGmailMailboxConfig({
      email: emailResult.email,
      fromName: existingCfg.from_name,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      grantedScopes:
        grantedScopes.length > 0 ? grantedScopes : [...GMAIL_OAUTH_SCOPE_IDS],
      existingRefreshToken: existingCfg.refresh_token,
    }),
    ...sharedPatch,
  };

  if (!config.refresh_token) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: "gmail_refresh_token_missing",
    });
  }

  const { error } = await admin.from("restaurant_integrations").upsert(
    {
      restaurant_id: state.restaurantId,
      integration_key: "email",
      waha_session_name: "email",
      status: "gmail",
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

  if (existing?.status !== "gmail" && existing?.status !== "custom") {
    void syncInboxHistoryOnConnect(admin, {
      restaurantId: state.restaurantId,
      email: true,
    }).catch((e) => {
      console.warn("[contact-inbox] history-on-connect gmail", e);
    });
  }

  return redirectToSettingsIntegrations(req, {
    provider: "email",
    result: "connected",
  });
}
