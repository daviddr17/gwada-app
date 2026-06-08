import { closeRegisterSession } from "@/lib/pos/fiskaly-register-session";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");

  const auth = await authorizePosRestaurant(request, restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await closeRegisterSession(auth.auth.restaurantId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status ?? 502 });
  }

  return Response.json(result);
}
