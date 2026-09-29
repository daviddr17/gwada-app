import { authorizeAdyenRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { disconnectRestaurantAdyenAdmin } from "@/lib/supabase/restaurant-adyen-connection-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { restaurantId?: string };
  const auth = await authorizeAdyenRestaurantRoute(body.restaurantId ?? null);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const result = await disconnectRestaurantAdyenAdmin(auth.ctx.restaurantId);
  if (result.error) return Response.json({ error: result.error }, { status: 500 });
  return Response.json({ ok: true });
}
