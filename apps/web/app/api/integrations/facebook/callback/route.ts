import {
  redirectToMetaPageSelection,
  redirectWithClearedMetaPending,
} from "@/lib/integrations/meta-oauth-callback-server";
import { finalizeFacebookIntegration } from "@/lib/integrations/meta-oauth-finalize-server";
import {
  decodeOAuthState,
  exchangeMetaCodeForToken,
  fetchMetaGrantedScopes,
  fetchMetaPageAccounts,
  getMetaPlatformConfigAdmin,
  metaOAuthCallbackUrl,
  metaPagesEligibleForMessenger,
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
      provider: "facebook",
      result: "error",
      message: String(oauthError).slice(0, 200),
    });
  }

  if (!code || !stateRaw) {
    return redirectToSettingsIntegrations(req, {
      provider: "facebook",
      result: "error",
      message: "missing_code",
    });
  }

  const state = decodeOAuthState(stateRaw);
  if (!state) {
    return redirectToSettingsIntegrations(req, {
      provider: "facebook",
      result: "error",
      message: "invalid_state",
    });
  }

  const platformCfg = await getMetaPlatformConfigAdmin("facebook");
  if (!platformCfg) {
    return redirectToSettingsIntegrations(req, {
      provider: "facebook",
      result: "error",
      message: "platform_not_configured",
    });
  }

  const redirectUri = metaOAuthCallbackUrl(req, "facebook");
  const tokenResult = await exchangeMetaCodeForToken({
    appId: platformCfg.appId,
    appSecret: platformCfg.appSecret,
    redirectUri,
    code,
  });

  if ("error" in tokenResult) {
    return redirectToSettingsIntegrations(req, {
      provider: "facebook",
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
      provider: "facebook",
      result: "error",
      message: pagesResult.error,
    });
  }

  const eligible = metaPagesEligibleForMessenger(pagesResult.pages);
  if (eligible.length === 0) {
    return redirectToSettingsIntegrations(req, {
      provider: "facebook",
      result: "error",
      message: "no_page_with_messaging",
    });
  }

  if (eligible.length > 1) {
    return await redirectToMetaPageSelection(req, {
      provider: "facebook",
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
      provider: "facebook",
      result: "error",
      message: "server_misconfigured",
    });
  }

  const page = eligible[0]!;
  const { error } = await finalizeFacebookIntegration(
    admin,
    state.restaurantId,
    page,
    tokenResult.accessToken,
    grantedScopes,
  );

  if (error) {
    return redirectToSettingsIntegrations(req, {
      provider: "facebook",
      result: "error",
      message: error,
    });
  }

  return redirectWithClearedMetaPending(req, {
    provider: "facebook",
    result: "connected",
  });
}
