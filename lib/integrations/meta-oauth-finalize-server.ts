import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FACEBOOK_OAUTH_SCOPE_IDS,
  INSTAGRAM_OAUTH_SCOPE_IDS,
} from "@/lib/constants/integration-oauth-scopes";
import type { MetaPageAccount } from "@/lib/integrations/meta-oauth-shared";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { upsertRestaurantOAuthIntegration } from "@/lib/supabase/restaurant-oauth-integration-db";

function mergeMetaConfig(
  existing: MetaOAuthIntegrationConfig,
  patch: MetaOAuthIntegrationConfig | undefined,
): MetaOAuthIntegrationConfig {
  return { ...existing, ...patch };
}

export async function finalizeFacebookIntegration(
  admin: SupabaseClient,
  restaurantId: string,
  page: MetaPageAccount,
  userAccessToken: string,
  grantedScopes: string[],
): Promise<{ error: string | null }> {
  if (!page.access_token?.trim()) {
    return { error: "no_page_with_messaging" };
  }

  const now = new Date().toISOString();
  return upsertRestaurantOAuthIntegration(
    admin,
    restaurantId,
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
        user_access_token: userAccessToken,
      },
    },
    oauthConfigFromJson<MetaOAuthIntegrationConfig>,
    mergeMetaConfig,
  );
}

export async function finalizeInstagramIntegration(
  admin: SupabaseClient,
  restaurantId: string,
  page: MetaPageAccount,
  userAccessToken: string,
  grantedScopes: string[],
): Promise<{ error: string | null }> {
  const ig = page.instagram_business_account;
  if (!page.access_token?.trim() || !ig?.id?.trim()) {
    return { error: "no_instagram_business_account" };
  }

  const displayName = ig.username ? `@${ig.username}` : page.name;
  const now = new Date().toISOString();
  return upsertRestaurantOAuthIntegration(
    admin,
    restaurantId,
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
        user_access_token: userAccessToken,
        instagram_business_account_id: ig.id,
        instagram_username: ig.username,
      },
    },
    oauthConfigFromJson<MetaOAuthIntegrationConfig>,
    mergeMetaConfig,
  );
}
