import { authorizeGoogleBusinessRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { syncGoogleBusinessReservationLink } from "@/lib/integrations/google-business-reservation-link-sync-server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  const auth = await authorizeGoogleBusinessRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const result = await syncGoogleBusinessReservationLink(restaurantId);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true });
}
