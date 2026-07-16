import {
  getPosGiftVoucherStats,
  issuePosGiftVoucher,
  listPosGiftVouchers,
} from "@/lib/pos/pos-gift-vouchers-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");
  const authResult = await authorizePosRestaurant(request, restaurantId);
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");
  const vouchers = await listPosGiftVouchers(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
    { status, search },
  );
  const stats = await getPosGiftVoucherStats(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
  );

  return posJson({ vouchers, stats });
}

type IssueBody = {
  restaurantId?: string;
  amountCents?: number;
  note?: string | null;
  validityMonths?: number | null;
};

export async function POST(request: Request) {
  let body: IssueBody;
  try {
    body = (await request.json()) as IssueBody;
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

  const result = await issuePosGiftVoucher({
    supabase: authResult.auth.supabase,
    restaurantId: authResult.auth.restaurantId,
    amountCents: Number(body.amountCents),
    actorProfileId: authResult.auth.userId,
    note: body.note,
    validityMonths: body.validityMonths,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({ voucher: result.voucher });
}
