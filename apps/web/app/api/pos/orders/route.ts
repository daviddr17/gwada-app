import { createPosOrder, type CreatePosOrderLineInput } from "@/lib/pos/pos-order-server";
import { loadPosOrderDto, posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type CreateOrderBody = {
  restaurantId?: string;
  tableSessionId?: string;
  items?: CreatePosOrderLineInput[];
  notes?: string | null;
};

export async function POST(request: Request) {
  let body: CreateOrderBody;
  try {
    body = (await request.json()) as CreateOrderBody;
  } catch {
    return posError("invalid_request", 400);
  }

  const authResult = await authorizePosRestaurant(request, body.restaurantId ?? null);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const tableSessionId = body.tableSessionId?.trim() ?? "";
  if (!tableSessionId) {
    return posError("invalid_table_session_id", 400);
  }

  const result = await createPosOrder({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    tableSessionId,
    createdByProfileId: authResult.auth.userId,
    items: body.items ?? [],
    notes: body.notes,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  const order = await loadPosOrderDto(authResult.auth.supabase, result.orderId);
  return posJson({
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    order,
  });
}
