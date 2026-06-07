import { authorizeWahaRestaurantRoute } from "@/lib/integrations/waha-route-auth";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaRequestPairingCode } from "@/lib/waha/waha-client";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    phoneNumber?: string;
  };
  const auth = await authorizeWahaRestaurantRoute(body.restaurantId ?? null);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const phone = body.phoneNumber?.replace(/\D/g, "") ?? "";
  if (phone.length < 8) {
    return Response.json({ error: "invalid_phone" }, { status: 400 });
  }

  const waha = await getWahaServerConfigAdmin();
  if (!waha) {
    return Response.json({ error: "waha_not_configured" }, { status: 503 });
  }

  const sessionName = wahaSessionNameForRestaurant(auth.ctx.restaurantId);
  const result = await wahaRequestPairingCode(waha, sessionName, phone);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ code: result.data.code });
}
