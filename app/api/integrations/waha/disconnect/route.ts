import { upsertRestaurantWhatsappIntegration } from "@/lib/supabase/restaurant-integrations-db";
import { authorizeWahaRestaurantRoute } from "@/lib/integrations/waha-route-auth";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaLogoutSession, wahaStopSession } from "@/lib/waha/waha-client";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
  };
  const auth = await authorizeWahaRestaurantRoute(body.restaurantId ?? null);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const waha = await getWahaServerConfigAdmin();
  const sessionName = wahaSessionNameForRestaurant(auth.ctx.restaurantId);

  if (waha) {
    await wahaLogoutSession(waha, sessionName);
    await wahaStopSession(waha, sessionName);
  }

  const { error } = await upsertRestaurantWhatsappIntegration(
    auth.ctx.supabase,
    auth.ctx.restaurantId,
    {
      status: "disconnected",
      phone_number: null,
      display_name: null,
      connected_at: null,
      last_error: null,
    },
  );

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
