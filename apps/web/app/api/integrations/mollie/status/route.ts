import {
  MOLLIE_PLATFORM_DISABLED_MESSAGE,
  MOLLIE_PLATFORM_NOT_READY_MESSAGE,
  publicMollieConnection,
} from "@/lib/integrations/mollie-connect";
import { getMolliePlatformSecretsAdmin } from "@/lib/integrations/mollie-oauth";
import { authorizeMollieRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { isPlatformIntegrationEnabledAdmin } from "@/lib/supabase/platform-integration-enabled";
import { fetchRestaurantMollieConnectionAdmin } from "@/lib/supabase/restaurant-mollie-connection-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeMollieRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const [platformEnabled, secrets, connection] = await Promise.all([
    isPlatformIntegrationEnabledAdmin("mollie"),
    getMolliePlatformSecretsAdmin(),
    fetchRestaurantMollieConnectionAdmin(auth.ctx.restaurantId),
  ]);

  const platformConfigured = Boolean(secrets);
  const pub = publicMollieConnection(connection.row);
  const message = !platformConfigured
    ? MOLLIE_PLATFORM_NOT_READY_MESSAGE
    : !platformEnabled
      ? MOLLIE_PLATFORM_DISABLED_MESSAGE
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
