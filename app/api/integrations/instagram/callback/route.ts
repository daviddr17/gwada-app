import { INSTAGRAM_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import {
  decodeOAuthState,
  exchangeMetaCodeForToken,
  fetchMetaGrantedScopes,
  fetchMetaPageAccounts,
  getMetaPlatformConfigAdmin,
  metaOAuthCallbackUrl,
  pickMetaPageForInstagram,
  settingsIntegrationsUrl,
} from "@/lib/integrations/meta-oauth-shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
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
        provider: "instagram",
        result: "error",
        message: String(oauthError).slice(0, 200),
      }),
    );
  }

  if (!code || !stateRaw) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "instagram",
        result: "error",
        message: "missing_code",
      }),
    );
  }

  const state = decodeOAuthState(stateRaw);
  if (!state) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "instagram",
        result: "error",
        message: "invalid_state",
      }),
    );
  }

  const platformCfg = await getMetaPlatformConfigAdmin("instagram");
  if (!platformCfg) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "instagram",
        result: "error",
        message: "platform_not_configured",
      }),
    );
  }

  const redirectUri = metaOAuthCallbackUrl(req, "instagram");
  const tokenResult = await exchangeMetaCodeForToken({
    appId: platformCfg.appId,
    appSecret: platformCfg.appSecret,
    redirectUri,
    code,
  });

  if ("error" in tokenResult) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "instagram",
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
        provider: "instagram",
        result: "error",
        message: pagesResult.error,
      }),
    );
  }

  const page = pickMetaPageForInstagram(pagesResult.pages);
  const ig = page?.instagram_business_account;
  if (!page?.access_token || !ig?.id) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "instagram",
        result: "error",
        message: "no_instagram_business_account",
      }),
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "instagram",
        result: "error",
        message: "server_misconfigured",
      }),
    );
  }

  const displayName = ig.username
    ? `@${ig.username}`
    : page.name;
  const now = new Date().toISOString();

  const { error } = await upsertRestaurantOAuthIntegration(
    admin,
    state.restaurantId,
    "instagram",
    {
      status: "working",
      display_name: displayName,
      connected_at: now,
      last_error: null,
      config: {
        requested_scopes: [...INSTAGRAM_OAUTH_SCOPE_IDS],
        granted_scopes: grantedScopes,
        scopes_checked_at: now,
        page_id: page.id,
        page_name: page.name,
        page_access_token: page.access_token,
        user_access_token: tokenResult.accessToken,
        instagram_business_account_id: ig.id,
        instagram_username: ig.username,
      },
    },
    oauthConfigFromJson<MetaOAuthIntegrationConfig>,
    mergeMetaConfig,
  );

  if (error) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "instagram",
        result: "error",
        message: error,
      }),
    );
  }

  return Response.redirect(
    settingsIntegrationsUrl({ provider: "instagram", result: "connected" }),
  );
}
