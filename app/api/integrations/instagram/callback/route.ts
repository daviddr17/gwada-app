import { INSTAGRAM_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import {
  redirectToMetaPageSelection,
  redirectWithClearedMetaPending,
} from "@/lib/integrations/meta-oauth-callback-server";
import { finalizeInstagramIntegration } from "@/lib/integrations/meta-oauth-finalize-server";
import {
  decodeOAuthState,
  exchangeMetaCodeForToken,
  fetchMetaGrantedScopes,
  fetchMetaPageAccounts,
  getMetaPlatformConfigAdmin,
  metaOAuthCallbackUrl,
  metaPagesEligibleForInstagram,
  redirectToSettingsIntegrations,
} from "@/lib/integrations/meta-oauth-shared";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim();
  const stateRaw = searchParams.get("state")?.trim();
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return redirectToSettingsIntegrations(req, {
      provider: "instagram",
      result: "error",
      message: String(oauthError).slice(0, 200),
    });
  }

  if (!code || !stateRaw) {
    return redirectToSettingsIntegrations(req, {
      provider: "instagram",
      result: "error",
      message: "missing_code",
    });
  }

  const state = decodeOAuthState(stateRaw);
  if (!state) {
    return redirectToSettingsIntegrations(req, {
      provider: "instagram",
      result: "error",
      message: "invalid_state",
    });
  }

  const platformCfg = await getMetaPlatformConfigAdmin("instagram");
  if (!platformCfg) {
    return redirectToSettingsIntegrations(req, {
      provider: "instagram",
      result: "error",
      message: "platform_not_configured",
    });
  }

  const redirectUri = metaOAuthCallbackUrl(req, "instagram");
  const tokenResult = await exchangeMetaCodeForToken({
    appId: platformCfg.appId,
    appSecret: platformCfg.appSecret,
    redirectUri,
    code,
  });

  if ("error" in tokenResult) {
    return redirectToSettingsIntegrations(req, {
      provider: "instagram",
      result: "error",
      message: tokenResult.error,
    });
  }

  const grantedScopes = await fetchMetaGrantedScopes({
    appId: platformCfg.appId,
    appSecret: platformCfg.appSecret,
    userAccessToken: tokenResult.accessToken,
  });

  const pagesResult = await fetchMetaPageAccounts(tokenResult.accessToken);
  if ("error" in pagesResult) {
    return redirectToSettingsIntegrations(req, {
      provider: "instagram",
      result: "error",
      message: pagesResult.error,
    });
  }

  const eligible = metaPagesEligibleForInstagram(pagesResult.pages);
  if (eligible.length === 0) {
    return redirectToSettingsIntegrations(req, {
      provider: "instagram",
      result: "error",
      message: "no_instagram_business_account",
    });
  }

  if (eligible.length > 1) {
    return redirectToMetaPageSelection(req, {
      provider: "instagram",
      restaurantId: state.restaurantId,
      userAccessToken: tokenResult.accessToken,
      grantedScopes,
      pages: eligible,
    });
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return redirectToSettingsIntegrations(req, {
      provider: "instagram",
      result: "error",
      message: "server_misconfigured",
    });
  }

  const page = eligible[0]!;
  const { error } = await finalizeInstagramIntegration(
    admin,
    state.restaurantId,
    page,
    tokenResult.accessToken,
    grantedScopes.length > 0 ? grantedScopes : [...INSTAGRAM_OAUTH_SCOPE_IDS],
  );

  if (error) {
    return redirectToSettingsIntegrations(req, {
      provider: "instagram",
      result: "error",
      message: error,
    });
  }

  return redirectWithClearedMetaPending(req, {
    provider: "instagram",
    result: "connected",
  });
}
