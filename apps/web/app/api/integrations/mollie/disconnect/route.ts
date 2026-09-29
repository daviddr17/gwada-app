import { authorizeMollieRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { disconnectRestaurantMollieAdmin } from "@/lib/supabase/restaurant-mollie-connection-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { restaurantId?: string };
  const auth = await authorizeMollieRestaurantRoute(body.restaurantId ?? null);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const result = await disconnectRestaurantMollieAdmin(auth.ctx.restaurantId);
  if (result.error) return Response.json({ error: result.error }, { status: 500 });
  return Response.json({ ok: true });
}
