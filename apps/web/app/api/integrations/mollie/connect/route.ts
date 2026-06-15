import {
  buildMollieOAuthUrl,
  encodeMollieOAuthState,
  getMolliePlatformOAuthAdmin,
  mollieOAuthCallbackUrl,
} from "@/lib/integrations/mollie-oauth";
import { redirectToSettingsIntegrations } from "@/lib/integrations/meta-oauth-shared";
import { authorizeMollieRestaurantRoute } from "@/lib/integrations/oauth-route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeMollieRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: auth.error,
    });
  }

  const platformCfg = await getMolliePlatformOAuthAdmin();
  if (!platformCfg) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: "platform_not_configured",
    });
  }

  const redirectUri = mollieOAuthCallbackUrl(req);
  const state = encodeMollieOAuthState(auth.ctx.restaurantId);
  const url = buildMollieOAuthUrl({
    clientId: platformCfg.clientId,
    redirectUri,
    state,
  });

  return Response.redirect(url);
}
