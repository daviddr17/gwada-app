import {
  buildGmailOAuthUrl,
  encodeGmailOAuthState,
  getGmailOAuthPlatformConfigAdmin,
  gmailOAuthCallbackUrl,
} from "@/lib/integrations/gmail-oauth";
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

  const platformCfg = await getGmailOAuthPlatformConfigAdmin();
  if (!platformCfg) {
    return redirectToSettingsIntegrations(req, {
      provider: "email",
      result: "error",
      message: "platform_not_configured",
    });
  }

  const redirectUri = gmailOAuthCallbackUrl(req);
  const state = encodeGmailOAuthState({
    restaurantId: auth.ctx.restaurantId,
    purpose,
    userId: purpose === "personal" ? auth.ctx.userId : undefined,
  });
  const oauthUrl = buildGmailOAuthUrl({
    clientId: platformCfg.clientId,
    redirectUri,
    state,
  });

  return Response.redirect(oauthUrl);
}
