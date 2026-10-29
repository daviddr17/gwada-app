import {
  buildOutlookOAuthUrl,
  encodeOutlookOAuthState,
  getOutlookOAuthPlatformConfigAdmin,
  outlookOAuthCallbackUrl,
} from "@/lib/integrations/outlook-oauth";
import { redirectToSettingsIntegrations } from "@/lib/integrations/meta-oauth-shared";
import {
  authorizeEmailRestaurantRoute,
  authorizePersonalEmailRestaurantRoute,
} from "@/lib/integrations/oauth-route-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const purpose =
    url.searchParams.get("purpose")?.trim() === "personal"
      ? "personal"
      : "shared";

  const auth =
    purpose === "personal"
      ? await authorizePersonalEmailRestaurantRoute(restaurantId)
      : await authorizeEmailRestaurantRoute(restaurantId);
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
    purpose,
    userId: purpose === "personal" ? auth.ctx.userId : undefined,
  });
  const oauthUrl = buildOutlookOAuthUrl({
    clientId: platformCfg.clientId,
    redirectUri,
    state,
  });

  return Response.redirect(oauthUrl);
}
