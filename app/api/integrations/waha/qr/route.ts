import { authorizeWahaRestaurantRoute } from "@/lib/integrations/waha-route-auth";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaGetQrBase64 } from "@/lib/waha/waha-client";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const auth = await authorizeWahaRestaurantRoute(
    searchParams.get("restaurantId"),
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const waha = await getWahaServerConfigAdmin();
  if (!waha) {
    return Response.json({ error: "waha_not_configured" }, { status: 503 });
  }

  const sessionName = wahaSessionNameForRestaurant(auth.ctx.restaurantId);
  const qr = await wahaGetQrBase64(waha, sessionName);
  if (!qr.ok) {
    return Response.json({ error: qr.error }, { status: qr.status });
  }

  return Response.json(qr.data);
}
