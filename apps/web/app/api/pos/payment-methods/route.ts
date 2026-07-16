import {
  createCustomPosPaymentMethod,
  listPosRestaurantPaymentMethods,
} from "@/lib/pos/pos-payment-methods-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const activeOnly = url.searchParams.get("activeOnly") === "1";

  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const methods = await listPosRestaurantPaymentMethods(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
    { activeOnly },
  );

  return posJson({ methods });
}

type PostBody = {
  restaurantId?: string;
  label?: string;
};

export async function POST(request: Request) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(
    request,
    body.restaurantId ?? null,
  );
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const result = await createCustomPosPaymentMethod(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
    body.label ?? "",
  );

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({ method: result.method });
}
