import {
  ADYEN_PLATFORM_DISABLED_MESSAGE,
  ADYEN_PLATFORM_NOT_READY_MESSAGE,
  publicAdyenConnection,
} from "@/lib/integrations/adyen-connect";
import { getAdyenPlatformSecretsAdmin } from "@/lib/integrations/adyen-hosted-onboarding";
import { authorizeAdyenRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { isPlatformIntegrationEnabledAdmin } from "@/lib/supabase/platform-integration-enabled";
import { fetchRestaurantAdyenConnectionAdmin } from "@/lib/supabase/restaurant-adyen-connection-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeAdyenRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const [platformEnabled, secrets, connection] = await Promise.all([
    isPlatformIntegrationEnabledAdmin("adyen"),
    getAdyenPlatformSecretsAdmin(),
    fetchRestaurantAdyenConnectionAdmin(auth.ctx.restaurantId),
  ]);

  const platformConfigured = Boolean(secrets);
  const pub = publicAdyenConnection(connection.row);
  const message = !platformConfigured
    ? ADYEN_PLATFORM_NOT_READY_MESSAGE
    : !platformEnabled
      ? ADYEN_PLATFORM_DISABLED_MESSAGE
      : undefined;

  return Response.json({
    platformEnabled,
    platformConfigured,
    status: pub.status,
    displayName: pub.displayName,
    connectedAt: pub.connectedAt,
    message,
  });
}
