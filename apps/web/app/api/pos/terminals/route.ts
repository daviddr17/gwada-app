import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { listRestaurantMollieTerminals } from "@/lib/pos/mollie-pos-payment";

export const dynamic = "force-dynamic";

/** List Mollie terminals for the connected restaurant org. */
export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? null;

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const result = await listRestaurantMollieTerminals(
    authResult.auth.restaurantId,
  );
  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({
    ok: true,
    terminals: result.terminals.map((t) => ({
      id: t.id,
      status: t.status ?? null,
      brand: t.brand ?? null,
      model: t.model ?? null,
      description: t.description ?? null,
    })),
  });
}
