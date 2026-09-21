import { authorizeWahaRestaurantRoute } from "@/lib/integrations/waha-route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadReservationWhatsappOutboxHealth } from "@/lib/whatsapp/reservation-whatsapp-outbox-health";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const auth = await authorizeWahaRestaurantRoute(
    searchParams.get("restaurantId"),
    { requireBilling: false },
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const health = await loadReservationWhatsappOutboxHealth(
    admin,
    auth.ctx.restaurantId,
  );
  return Response.json(health);
}
