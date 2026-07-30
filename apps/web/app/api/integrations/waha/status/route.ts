import { buildWhatsappStatusResponse } from "@/lib/integrations/waha-api-response";
import { syncWhatsappFromWaha } from "@/lib/integrations/waha-connect-service";
import { authorizeWahaRestaurantRoute } from "@/lib/integrations/waha-route-auth";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const auth = await authorizeWahaRestaurantRoute(
    searchParams.get("restaurantId"),
  );
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
    );
  }

  const refresh = searchParams.get("refresh") === "1";
  if (refresh) {
    const live = await syncWhatsappFromWaha(
      auth.ctx.supabase,
      waha,
      auth.ctx.restaurantId,
    );
    return Response.json(live);
  }

  return Response.json(
    await buildWhatsappStatusResponse(
      auth.ctx.supabase,
      auth.ctx.restaurantId,
      true,
    ),
  );
}
