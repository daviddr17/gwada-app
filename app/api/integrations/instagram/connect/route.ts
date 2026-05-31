import { INSTAGRAM_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import {
  buildMetaOAuthUrl,
  encodeOAuthState,
  getMetaPlatformConfigAdmin,
  metaOAuthCallbackUrl,
  redirectToSettingsIntegrations,
} from "@/lib/integrations/meta-oauth-shared";
import { authorizeInstagramRestaurantRoute } from "@/lib/integrations/oauth-route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeInstagramRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return redirectToSettingsIntegrations(req, {
      provider: "instagram",
      result: "error",
      message: auth.error,
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
  const state = encodeOAuthState({ restaurantId: auth.ctx.restaurantId });
  const url = buildMetaOAuthUrl({
    appId: platformCfg.appId,
    redirectUri,
    state,
    scopeIds: INSTAGRAM_OAUTH_SCOPE_IDS,
  });

  return Response.redirect(url);
}
