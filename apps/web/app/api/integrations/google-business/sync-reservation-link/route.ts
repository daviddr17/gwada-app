import { authorizeGoogleBusinessRestaurantRoute } from "@/lib/integrations/oauth-route-auth";
import { setGoogleBusinessReservationBookingLink } from "@/lib/integrations/google-business-reservation-link-sync-server";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    enabled?: boolean;
  };
  const restaurantId = body.restaurantId?.trim() ?? "";
  if (typeof body.enabled !== "boolean") {
    return Response.json(
      { ok: false, error: "enabled_required" },
      { status: 400 },
    );
  }

  const auth = await authorizeGoogleBusinessRestaurantRoute(restaurantId);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const result = await setGoogleBusinessReservationBookingLink({
    restaurantId,
    enabled: body.enabled,
  });
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true, enabled: body.enabled });
}
