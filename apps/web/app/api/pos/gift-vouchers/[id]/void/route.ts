import { voidPosGiftVoucher } from "@/lib/pos/pos-gift-vouchers-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type Body = {
  restaurantId?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    body = {};
  }

  const authResult = await authorizePosRestaurant(
    request,
    body.restaurantId ?? null,
  );
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const result = await voidPosGiftVoucher({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    voucherId: id,
    actorProfileId: authResult.auth.userId,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({ voucher: result.voucher });
}
