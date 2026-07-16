import {
  collectVoucherAllocations,
  loadPosSessionSummary,
} from "@/lib/pos/pos-session-settlement-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type Body = {
  restaurantId?: string;
  tableSessionId?: string;
  giftVoucherId?: string;
  allocations?: Array<{ orderLineId?: string; quantity?: number }>;
  tipCents?: number;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
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

  const tableSessionId = body.tableSessionId?.trim() ?? "";
  const giftVoucherId = body.giftVoucherId?.trim() ?? "";
  if (!tableSessionId) return posError("invalid_table_session_id", 400);
  if (!giftVoucherId) return posError("invalid_gift_voucher_id", 400);

  const allocations = (body.allocations ?? [])
    .filter((a) => a.orderLineId?.trim())
    .map((a) => ({
      orderLineId: a.orderLineId!.trim(),
      quantity: Number(a.quantity),
    }));

  if (allocations.length === 0) {
    return posError("empty_allocations", 400);
  }

  const result = await collectVoucherAllocations({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    tableSessionId,
    giftVoucherId,
    allocations,
    tipCents: body.tipCents,
    actorProfileId: authResult.auth.userId,
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
    remainingVoucherCents: result.remainingVoucherCents,
    voucherCode: result.voucherCode,
    summary: summary.ok ? summary.summary : null,
  });
}
