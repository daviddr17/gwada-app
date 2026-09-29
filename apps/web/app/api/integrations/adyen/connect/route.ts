import {
  ADYEN_PLATFORM_DISABLED_MESSAGE,
  ADYEN_PLATFORM_NOT_READY_MESSAGE,
} from "@/lib/integrations/adyen-connect";
import {
  adyenOnboardingReturnUrl,
  createAdyenHostedOnboardingRedirect,
  getAdyenPlatformReadyAdmin,
  getAdyenPlatformSecretsAdmin,
} from "@/lib/integrations/adyen-hosted-onboarding";
import { redirectToSettingsIntegrations } from "@/lib/integrations/meta-oauth-shared";
import { authorizeAdyenRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { isPlatformIntegrationEnabledAdmin } from "@/lib/supabase/platform-integration-enabled";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeAdyenRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return redirectToSettingsIntegrations(req, {
      provider: "adyen",
      result: "error",
      message: auth.error === "unauthorized" ? "Bitte erneut anmelden." : auth.error,
    });
  }

  const [enabled, secrets] = await Promise.all([
    isPlatformIntegrationEnabledAdmin("adyen"),
    getAdyenPlatformSecretsAdmin(),
  ]);
  if (!secrets) {
    return redirectToSettingsIntegrations(req, {
      provider: "adyen",
      result: "error",
      message: ADYEN_PLATFORM_NOT_READY_MESSAGE,
    });
  }
  if (!enabled) {
    return redirectToSettingsIntegrations(req, {
      provider: "adyen",
      result: "error",
      message: ADYEN_PLATFORM_DISABLED_MESSAGE,
    });
  }

  const ready = await getAdyenPlatformReadyAdmin();
  if (!ready) {
    return redirectToSettingsIntegrations(req, {
      provider: "adyen",
      result: "error",
      message: ADYEN_PLATFORM_NOT_READY_MESSAGE,
    });
  }

  const link = await createAdyenHostedOnboardingRedirect({
    restaurantId: auth.ctx.restaurantId,
    secrets: ready,
    returnUrl: adyenOnboardingReturnUrl(req, auth.ctx.restaurantId),
  });
  if ("error" in link) {
    return redirectToSettingsIntegrations(req, {
      provider: "adyen",
      result: "error",
      message: link.error,
    });
  }
  return Response.redirect(link.url);
}
