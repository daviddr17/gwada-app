import { authorizeContactMessagesRestaurant } from "@/lib/contact-messages/route-auth";
import { resolveRestaurantChannelConnectionsServer } from "@/lib/contact-messages/restaurant-channel-connections-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId");
  const auth = await authorizeContactMessagesRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const payload = await resolveRestaurantChannelConnectionsServer({
    restaurantId: auth.restaurantId,
    supabase: auth.supabase,
  });

  return Response.json(payload);
}
