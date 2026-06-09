import { collectCashAllocations, loadPosSessionSummary } from "@/lib/pos/pos-session-settlement-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type CollectAllocationsBody = {
  restaurantId?: string;
  tableSessionId?: string;
  allocations?: Array<{ orderLineId?: string; quantity?: number }>;
  tipCents?: number;
  receivedAmountCents?: number | null;
};

export async function POST(request: Request) {
  let body: CollectAllocationsBody;
  try {
    body = (await request.json()) as CollectAllocationsBody;
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

  const allocations = (body.allocations ?? [])
    .filter((a) => a.orderLineId?.trim())
    .map((a) => ({
      orderLineId: a.orderLineId!.trim(),
      quantity: Number(a.quantity),
    }));

  if (allocations.length === 0) {
    return posError("empty_allocations", 400);
  }

  const result = await collectCashAllocations({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    tableSessionId,
    allocations,
    tipCents: body.tipCents,
    receivedAmountCents: body.receivedAmountCents,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  const summary = await loadPosSessionSummary({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    sessionId: tableSessionId,
  });

  return posJson({
    paymentId: result.paymentId,
    summary: summary.ok ? summary.summary : null,
  });
}
