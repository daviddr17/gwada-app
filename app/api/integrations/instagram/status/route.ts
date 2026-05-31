import { authorizeInstagramRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { getMetaPlatformConfigAdmin } from "@/lib/integrations/meta-oauth-shared";
import { publicOAuthFieldsFromConfig } from "@/lib/integrations/oauth-integration-types";
import { fetchRestaurantOAuthIntegration } from "@/lib/supabase/restaurant-oauth-integration-db";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { oauthPlatformEnabledForProvider } from "@/lib/integrations/oauth-integration-status";
import { RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE } from "@/lib/constants/restaurant-integration-messages";
import type { OAuthIntegrationStatusResponse } from "@/lib/types/oauth-integration-response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeInstagramRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const platformEnabled = await oauthPlatformEnabledForProvider(
    auth.ctx.supabase,
    "instagram",
  );
  const platformCfg = platformEnabled
    ? await getMetaPlatformConfigAdmin("instagram")
    : null;
  const row = await fetchRestaurantOAuthIntegration(
    auth.ctx.supabase,
    auth.ctx.restaurantId,
    "instagram",
    oauthConfigFromJson<MetaOAuthIntegrationConfig>,
  );

  const oauth = row ? publicOAuthFieldsFromConfig(row.config) : null;
  const igUser = row?.config.instagram_username;

  const body: OAuthIntegrationStatusResponse = {
    platformEnabled,
    platformConfigured: Boolean(platformCfg),
    configured: Boolean(row),
    status: row?.status ?? "disconnected",
    displayName: row?.display_name ?? null,
    accountId: row?.config.instagram_business_account_id ?? null,
    secondaryLabel: row?.config.page_name
      ? `Facebook-Seite: ${row.config.page_name}`
      : null,
    connectedAt: row?.connected_at ?? null,
    requestedScopes: oauth?.requested_scopes ?? [],
    grantedScopes: oauth?.granted_scopes ?? [],
    message:
      !platformEnabled || !platformCfg
      ? RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE
      : !igUser && row?.status === "working"
        ? "Instagram ist verbunden, der Profilname konnte aber nicht geladen werden."
        : undefined,
  };

  return Response.json(body);
}
