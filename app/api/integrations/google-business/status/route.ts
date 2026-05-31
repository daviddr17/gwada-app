import { authorizeGoogleBusinessRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { getGoogleBusinessPlatformConfigAdmin } from "@/lib/integrations/google-business-oauth";
import { publicOAuthFieldsFromConfig } from "@/lib/integrations/oauth-integration-types";
import { fetchRestaurantOAuthIntegration } from "@/lib/supabase/restaurant-oauth-integration-db";
import { googleBusinessConfigFromJson } from "@/lib/integrations/google-business-oauth";
import { oauthPlatformEnabledForProvider } from "@/lib/integrations/oauth-integration-status";
import { RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE } from "@/lib/constants/restaurant-integration-messages";
import type { OAuthIntegrationStatusResponse } from "@/lib/types/oauth-integration-response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeGoogleBusinessRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const platformEnabled = await oauthPlatformEnabledForProvider(
    auth.ctx.supabase,
    "google_business",
  );
  const platformCfg = platformEnabled
    ? await getGoogleBusinessPlatformConfigAdmin()
    : null;
  const row = await fetchRestaurantOAuthIntegration(
    auth.ctx.supabase,
    auth.ctx.restaurantId,
    "google_business",
    googleBusinessConfigFromJson,
  );

  const oauth = row ? publicOAuthFieldsFromConfig(row.config) : null;

  const body: OAuthIntegrationStatusResponse = {
    platformEnabled,
    platformConfigured: Boolean(platformCfg),
    configured: Boolean(row),
    status: row?.status ?? "disconnected",
    displayName: row?.display_name ?? row?.config.location_title ?? null,
    accountId: row?.config.account_name ?? null,
    secondaryLabel: row?.config.account_title ?? null,
    connectedAt: row?.connected_at ?? null,
    requestedScopes: oauth?.requested_scopes ?? [],
    grantedScopes: oauth?.granted_scopes ?? [],
    message:
      !platformEnabled || !platformCfg
        ? RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE
        : undefined,
  };

  return Response.json(body);
}
