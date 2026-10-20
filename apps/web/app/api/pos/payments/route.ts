import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";
import { createMolliePosPayment } from "@/lib/pos/mollie-pos-payment";

export const dynamic = "force-dynamic";

/** Mollie in-person: Payments API method=pointofsale + terminalId. */
export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    amountEuros?: number;
    description?: string;
    terminalId?: string;
    orderId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
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

  const result = await createMolliePosPayment({
    restaurantId: authResult.auth.restaurantId,
    amountEuros: Number(body.amountEuros),
    description: body.description?.trim() || "POS Zahlung",
    terminalId: body.terminalId?.trim() || "",
    posOrderId: body.orderId?.trim() || null,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({
    ok: true,
    molliePaymentId: result.molliePaymentId,
    status: result.status,
  });
}
