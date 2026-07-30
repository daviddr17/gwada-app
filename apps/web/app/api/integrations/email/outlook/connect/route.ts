import {
  buildOutlookOAuthUrl,
  encodeOutlookOAuthState,
  getOutlookOAuthPlatformConfigAdmin,
  outlookOAuthCallbackUrl,
} from "@/lib/integrations/outlook-oauth";
import { redirectToSettingsIntegrations } from "@/lib/integrations/meta-oauth-shared";
import { authorizeEmailRestaurantRoute } from "@/lib/integrations/oauth-route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeEmailRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: auth.error,
    });
  }

  const platformCfg = await getOutlookOAuthPlatformConfigAdmin();
  if (!platformCfg) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: "platform_not_configured",
    });
  }

  const redirectUri = outlookOAuthCallbackUrl(req);
  const state = encodeOutlookOAuthState({
    restaurantId: auth.ctx.restaurantId,
  });
  const url = buildOutlookOAuthUrl({
    clientId: platformCfg.clientId,
    redirectUri,
    state,
  });

  return Response.redirect(url);
}
