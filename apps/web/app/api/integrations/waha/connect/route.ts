import { syncWhatsappFromWaha } from "@/lib/integrations/waha-connect-service";
import { buildWhatsappStatusResponse } from "@/lib/integrations/waha-api-response";
import { authorizeWahaRestaurantRoute } from "@/lib/integrations/waha-route-auth";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    restart?: boolean;
  };
  const auth = await authorizeWahaRestaurantRoute(body.restaurantId ?? null);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const waha = await getWahaServerConfigForRestaurantAdmin(auth.ctx.restaurantId);
  if (!waha) {
    return Response.json(
      await buildWhatsappStatusResponse(
        auth.ctx.supabase,
        auth.ctx.restaurantId,
        false,
      ),
      { status: 503 },
    );
  }

  const result = await syncWhatsappFromWaha(
    auth.ctx.supabase,
    waha,
    auth.ctx.restaurantId,
    { forceRestart: body.restart === true },
  );
  return Response.json(result);
}
