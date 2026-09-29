import {
  MOLLIE_PLATFORM_DISABLED_MESSAGE,
  MOLLIE_PLATFORM_NOT_READY_MESSAGE,
} from "@/lib/integrations/mollie-connect";
import {
  getMolliePlatformReadyAdmin,
  getMolliePlatformSecretsAdmin,
  mollieAuthorizeRedirect,
  mollieOAuthCallbackUrl,
} from "@/lib/integrations/mollie-oauth";
import { encodeOAuthState, redirectToSettingsIntegrations } from "@/lib/integrations/meta-oauth-shared";
import { authorizeMollieRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { isPlatformIntegrationEnabledAdmin } from "@/lib/supabase/platform-integration-enabled";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeMollieRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: auth.error === "unauthorized" ? "Bitte erneut anmelden." : auth.error,
    });
  }

  const [enabled, secrets] = await Promise.all([
    isPlatformIntegrationEnabledAdmin("mollie"),
    getMolliePlatformSecretsAdmin(),
  ]);
  if (!secrets) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: MOLLIE_PLATFORM_NOT_READY_MESSAGE,
    });
  }
  if (!enabled) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: MOLLIE_PLATFORM_DISABLED_MESSAGE,
    });
  }

  const ready = await getMolliePlatformReadyAdmin();
  if (!ready) {
    return redirectToSettingsIntegrations(req, {
      provider: "mollie",
      result: "error",
      message: MOLLIE_PLATFORM_NOT_READY_MESSAGE,
    });
  }

  const url = mollieAuthorizeRedirect({
    clientId: ready.clientId,
    redirectUri: mollieOAuthCallbackUrl(req),
    state: encodeOAuthState({ restaurantId: auth.ctx.restaurantId }),
  });
  return Response.redirect(url);
}
