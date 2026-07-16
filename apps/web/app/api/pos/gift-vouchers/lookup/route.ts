import { lookupPosGiftVoucher } from "@/lib/pos/pos-gift-vouchers-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type Body = {
  restaurantId?: string;
  code?: string;
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

  const result = await lookupPosGiftVoucher(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
    body.code ?? "",
  );

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({
    voucher: {
      id: result.voucher.id,
      code: result.voucher.code,
      balanceCents: result.voucher.balance_cents,
      initialAmountCents: result.voucher.initial_amount_cents,
      expiresAt: result.voucher.expires_at,
      status: result.voucher.status,
    },
  });
}
