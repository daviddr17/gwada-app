import { openLineQuantity } from "@gwada/pos-domain";
import {
  createMolliePosPayment,
  type MolliePaymentMethod,
} from "@/lib/pos/mollie-payment-server";
import { loadPosOrderDto, posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type CreateMollieBody = {
  restaurantId?: string;
  tableSessionId?: string;
  orderId?: string;
  method?: MolliePaymentMethod;
  tipCents?: number;
  redirectUrl?: string;
  allocations?: Array<{ orderLineId?: string; quantity?: number }>;
};

export async function POST(request: Request) {
  let body: CreateMollieBody;
  try {
    body = (await request.json()) as CreateMollieBody;
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(request, body.restaurantId ?? null);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const method = body.method === "paypal" ? "paypal" : "card";
  let tableSessionId = body.tableSessionId?.trim() ?? "";
  let allocations = (body.allocations ?? [])
    .filter((a) => a.orderLineId?.trim())
    .map((a) => ({
      orderLineId: a.orderLineId!.trim(),
      quantity: Number(a.quantity),
    }));

  if (body.orderId?.trim() && allocations.length === 0) {
    const order = await loadPosOrderDto(authResult.auth.supabase, body.orderId.trim());
    if (!order) return posError("order_not_found", 404);
    tableSessionId = order.tableSessionId;
    allocations = order.lines
      .map((line) => ({
        orderLineId: line.id,
        quantity: line.openQuantity ?? openLineQuantity(line.quantity, line.paidQuantity ?? 0),
      }))
      .filter((a) => a.quantity > 0);
  }

  if (!tableSessionId) {
    return posError("invalid_table_session_id", 400);
  }

  const result = await createMolliePosPayment({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    tableSessionId,
    allocations,
    method,
    tipCents: body.tipCents,
    redirectUrl: body.redirectUrl,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({
    paymentId: result.paymentId,
    molliePaymentId: result.molliePaymentId,
    checkoutUrl: result.checkoutUrl,
  });
}
