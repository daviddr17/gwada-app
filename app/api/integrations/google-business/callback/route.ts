import { GOOGLE_BUSINESS_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import {
  decodeGoogleOAuthState,
  exchangeGoogleBusinessCode,
  fetchGoogleBusinessAccount,
  getGoogleBusinessPlatformConfigAdmin,
  googleBusinessConfigFromJson,
  googleBusinessOAuthCallbackUrl,
  parseGoogleGrantedScopes,
} from "@/lib/integrations/google-business-oauth";
import { settingsIntegrationsUrl } from "@/lib/integrations/meta-oauth-shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { upsertRestaurantOAuthIntegration } from "@/lib/supabase/restaurant-oauth-integration-db";
import type { GoogleBusinessIntegrationConfig } from "@/lib/integrations/oauth-integration-types";

export const dynamic = "force-dynamic";

function mergeGoogleConfig(
  existing: GoogleBusinessIntegrationConfig,
  patch: GoogleBusinessIntegrationConfig | undefined,
): GoogleBusinessIntegrationConfig {
  return { ...existing, ...patch };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();
  const stateRaw = searchParams.get("state")?.trim();
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "google_business",
        result: "error",
        message: String(oauthError).slice(0, 200),
      }),
    );
  }

  if (!code || !stateRaw) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "google_business",
        result: "error",
        message: "missing_code",
      }),
    );
  }

  const state = decodeGoogleOAuthState(stateRaw);
  if (!state) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "google_business",
        result: "error",
        message: "invalid_state",
      }),
    );
  }

  const platformCfg = await getGoogleBusinessPlatformConfigAdmin();
  if (!platformCfg) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "google_business",
        result: "error",
        message: "platform_not_configured",
      }),
    );
  }

  const redirectUri = googleBusinessOAuthCallbackUrl(req);
  const tokenResult = await exchangeGoogleBusinessCode({
    clientId: platformCfg.clientId,
    clientSecret: platformCfg.clientSecret,
    redirectUri,
    code,
  });

  if ("error" in tokenResult) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "google_business",
        result: "error",
        message: tokenResult.error,
      }),
    );
  }

  const grantedScopes = parseGoogleGrantedScopes(tokenResult.scope);
  const accountResult = await fetchGoogleBusinessAccount({
    accessToken: tokenResult.accessToken,
  });

  if ("error" in accountResult) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "google_business",
        result: "error",
        message: accountResult.error,
      }),
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "google_business",
        result: "error",
        message: "server_misconfigured",
      }),
    );
  }

  const displayName =
    accountResult.locationTitle ??
    accountResult.accountTitle ??
    "Google Business";
  const now = new Date().toISOString();

  const { error } = await upsertRestaurantOAuthIntegration(
    admin,
    state.restaurantId,
    "google_business",
    {
      status: "working",
      display_name: displayName,
      connected_at: now,
      last_error: null,
      config: {
        requested_scopes: [...GOOGLE_BUSINESS_OAUTH_SCOPE_IDS],
        granted_scopes: grantedScopes,
        scopes_checked_at: now,
        account_name: accountResult.accountName,
        account_title: accountResult.accountTitle,
        location_name: accountResult.locationName,
        location_title: accountResult.locationTitle,
        refresh_token: tokenResult.refreshToken ?? undefined,
        access_token: tokenResult.accessToken,
      },
    },
    googleBusinessConfigFromJson,
    mergeGoogleConfig,
  );

  if (error) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "google_business",
        result: "error",
        message: error,
      }),
    );
  }

  return Response.redirect(
    settingsIntegrationsUrl({
      provider: "google_business",
      result: "connected",
    }),
  );
}
