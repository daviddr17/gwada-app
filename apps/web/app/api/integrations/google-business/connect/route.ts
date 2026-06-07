import {
  buildGoogleBusinessOAuthUrl,
  encodeGoogleOAuthState,
  getGoogleBusinessPlatformConfigAdmin,
  googleBusinessOAuthCallbackUrl,
} from "@/lib/integrations/google-business-oauth";
import { redirectToSettingsIntegrations } from "@/lib/integrations/meta-oauth-shared";
import { authorizeGoogleBusinessRestaurantRoute } from "@/lib/integrations/oauth-route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeGoogleBusinessRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return redirectToSettingsIntegrations(req, {
      provider: "google_business",
      result: "error",
      message: auth.error,
    });
  }

  const platformCfg = await getGoogleBusinessPlatformConfigAdmin();
  if (!platformCfg) {
    return redirectToSettingsIntegrations(req, {
      provider: "google_business",
      result: "error",
      message: "platform_not_configured",
    });
  }

  const redirectUri = googleBusinessOAuthCallbackUrl(req);
  const state = encodeGoogleOAuthState({ restaurantId: auth.ctx.restaurantId });
  const url = buildGoogleBusinessOAuthUrl({
    clientId: platformCfg.clientId,
    redirectUri,
    state,
  });

  return Response.redirect(url);
}
