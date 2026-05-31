import { FACEBOOK_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import {
  decodeOAuthState,
  exchangeMetaCodeForToken,
  fetchMetaGrantedScopes,
  fetchMetaPageAccounts,
  getMetaPlatformConfigAdmin,
  metaOAuthCallbackUrl,
  pickMetaPageForMessenger,
  settingsIntegrationsUrl,
} from "@/lib/integrations/meta-oauth-shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchRestaurantOAuthIntegration,
  upsertRestaurantOAuthIntegration,
} from "@/lib/supabase/restaurant-oauth-integration-db";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";

export const dynamic = "force-dynamic";

function mergeMetaConfig(
  existing: MetaOAuthIntegrationConfig,
  patch: MetaOAuthIntegrationConfig | undefined,
): MetaOAuthIntegrationConfig {
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
        provider: "facebook",
        result: "error",
        message: String(oauthError).slice(0, 200),
      }),
    );
  }

  if (!code || !stateRaw) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "facebook",
        result: "error",
        message: "missing_code",
      }),
    );
  }

  const state = decodeOAuthState(stateRaw);
  if (!state) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "facebook",
        result: "error",
        message: "invalid_state",
      }),
    );
  }

  const platformCfg = await getMetaPlatformConfigAdmin("facebook");
  if (!platformCfg) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "facebook",
        result: "error",
        message: "platform_not_configured",
      }),
    );
  }

  const redirectUri = metaOAuthCallbackUrl(req, "facebook");
  const tokenResult = await exchangeMetaCodeForToken({
    appId: platformCfg.appId,
    appSecret: platformCfg.appSecret,
    redirectUri,
    code,
  });

  if ("error" in tokenResult) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "facebook",
        result: "error",
        message: tokenResult.error,
      }),
    );
  }

  const grantedScopes = await fetchMetaGrantedScopes({
    appId: platformCfg.appId,
    appSecret: platformCfg.appSecret,
    userAccessToken: tokenResult.accessToken,
  });

  const pagesResult = await fetchMetaPageAccounts(tokenResult.accessToken);
  if ("error" in pagesResult) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "facebook",
        result: "error",
        message: pagesResult.error,
      }),
    );
  }

  const page = pickMetaPageForMessenger(pagesResult.pages);
  if (!page?.access_token) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "facebook",
        result: "error",
        message: "no_page_with_messaging",
      }),
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "facebook",
        result: "error",
        message: "server_misconfigured",
      }),
    );
  }

  const now = new Date().toISOString();
  const { error } = await upsertRestaurantOAuthIntegration(
    admin,
    state.restaurantId,
    "facebook",
    {
      status: "working",
      display_name: page.name,
      connected_at: now,
      last_error: null,
      config: {
        requested_scopes: [...FACEBOOK_OAUTH_SCOPE_IDS],
        granted_scopes: grantedScopes,
        scopes_checked_at: now,
        page_id: page.id,
        page_name: page.name,
        page_access_token: page.access_token,
        user_access_token: tokenResult.accessToken,
      },
    },
    oauthConfigFromJson<MetaOAuthIntegrationConfig>,
    mergeMetaConfig,
  );

  if (error) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "facebook",
        result: "error",
        message: error,
      }),
    );
  }

  return Response.redirect(
    settingsIntegrationsUrl({ provider: "facebook", result: "connected" }),
  );
}
