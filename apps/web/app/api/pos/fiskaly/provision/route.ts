import { provisionRestaurantFiskaly } from "@/lib/pos/fiskaly-provision";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");

  const auth = await authorizePosRestaurant(request, restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await provisionRestaurantFiskaly(auth.auth.restaurantId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json(result);
}
