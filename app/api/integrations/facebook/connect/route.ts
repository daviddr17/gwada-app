import { FACEBOOK_OAUTH_SCOPE_IDS } from "@/lib/constants/integration-oauth-scopes";
import {
  buildMetaOAuthUrl,
  encodeOAuthState,
  getMetaPlatformConfigAdmin,
  metaOAuthCallbackUrl,
  settingsIntegrationsUrl,
} from "@/lib/integrations/meta-oauth-shared";
import { authorizeFacebookRestaurantRoute } from "@/lib/integrations/oauth-route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeFacebookRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return Response.redirect(
      settingsIntegrationsUrl({
        provider: "facebook",
        result: "error",
        message: auth.error,
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
  const state = encodeOAuthState({ restaurantId: auth.ctx.restaurantId });
  const url = buildMetaOAuthUrl({
    appId: platformCfg.appId,
    redirectUri,
    state,
    scopeIds: FACEBOOK_OAUTH_SCOPE_IDS,
  });

  return Response.redirect(url);
}
