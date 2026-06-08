import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

/** Mollie card payments — Phase 2 (after Bar + Fiskaly MVP). */
export async function POST(request: Request) {
  let body: { restaurantId?: string };
  try {
    body = (await request.json()) as { restaurantId?: string };
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(request, body.restaurantId ?? null);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  return posError("mollie_not_implemented", 501);
}
