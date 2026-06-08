import { loadRegisterStatus } from "@/lib/pos/register-status-server";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");

  const auth = await authorizePosRestaurant(request, restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const status = await loadRegisterStatus(auth.auth.restaurantId);
  return Response.json(status);
}
