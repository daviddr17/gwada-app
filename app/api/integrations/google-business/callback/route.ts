import { GOOGLE_BUSINESS_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import { finalizeGoogleBusinessIntegration } from "@/lib/integrations/google-business-finalize-server";
import {
  decodeGoogleOAuthState,
  exchangeGoogleBusinessCode,
  fetchGoogleBusinessLocations,
  getGoogleBusinessPlatformConfigAdmin,
  googleBusinessOAuthCallbackUrl,
  parseGoogleGrantedScopes,
} from "@/lib/integrations/google-business-oauth";
import {
  redirectToGoogleLocationSelection,
  redirectWithClearedGooglePending,
} from "@/lib/integrations/google-oauth-callback-server";
import { redirectToSettingsIntegrations } from "@/lib/integrations/meta-oauth-shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();
  const stateRaw = searchParams.get("state")?.trim();
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return redirectToSettingsIntegrations(req, {
      provider: "google_business",
      result: "error",
      message: String(oauthError).slice(0, 200),
    });
  }

  if (!code || !stateRaw) {
    return redirectToSettingsIntegrations(req, {
      provider: "google_business",
      result: "error",
      message: "missing_code",
    });
  }

  const state = decodeGoogleOAuthState(stateRaw);
  if (!state) {
    return redirectToSettingsIntegrations(req, {
      provider: "google_business",
      result: "error",
      message: "invalid_state",
    });
  }

  const platformCfg = await getGoogleBusinessPlatformConfigAdmin();
  if (!platformCfg) {
    return redirectToSettingsIntegrations(req, {
      provider: "google_business",
      result: "error",
      message: "platform_not_configured",
    });
  }

  const redirectUri = googleBusinessOAuthCallbackUrl(req);
  const tokenResult = await exchangeGoogleBusinessCode({
    clientId: platformCfg.clientId,
    clientSecret: platformCfg.clientSecret,
    redirectUri,
    code,
  });

  if ("error" in tokenResult) {
    return redirectToSettingsIntegrations(req, {
      provider: "google_business",
      result: "error",
      message: tokenResult.error,
    });
  }

  const grantedScopes = parseGoogleGrantedScopes(tokenResult.scope);
  const locationsResult = await fetchGoogleBusinessLocations({
    accessToken: tokenResult.accessToken,
  });

  if ("error" in locationsResult) {
    return redirectToSettingsIntegrations(req, {
      provider: "google_business",
      result: "error",
      message: locationsResult.error,
    });
  }

  const locations = locationsResult.locations;

  if (locations.length > 1) {
    return redirectToGoogleLocationSelection(req, {
      restaurantId: state.restaurantId,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      grantedScopes:
        grantedScopes.length > 0 ? grantedScopes : [...GOOGLE_BUSINESS_OAUTH_SCOPE_IDS],
      locations,
    });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return redirectToSettingsIntegrations(req, {
      provider: "google_business",
      result: "error",
      message: "server_misconfigured",
    });
  }

  const location = locations[0]!;
  const { error } = await finalizeGoogleBusinessIntegration(
    admin,
    state.restaurantId,
    location,
    {
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      grantedScopes:
        grantedScopes.length > 0 ? grantedScopes : [...GOOGLE_BUSINESS_OAUTH_SCOPE_IDS],
    },
  );

  if (error) {
    return redirectToSettingsIntegrations(req, {
      provider: "google_business",
      result: "error",
      message: error,
    });
  }

  return redirectWithClearedGooglePending(req, {
    provider: "google_business",
    result: "connected",
  });
}
