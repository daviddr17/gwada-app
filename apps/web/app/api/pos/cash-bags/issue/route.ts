import { issueWaiterCashBag } from "@/lib/pos/waiter-cash-bag-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurantPermission } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type IssueBody = {
  staffProfileId?: string;
  openingFloatCents?: number;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const restaurantId = new URL(request.url).searchParams.get("restaurantId");

  const auth = await authorizePosRestaurantPermission(
    request,
    restaurantId,
    "pos.kasse.manage",
  );
  if (!auth.ok) {
    return posError(auth.error, auth.status);
  }

  if (!auth.auth.userId) {
    return posError("cashier_required", 403);
  }

  let body: IssueBody;
  try {
    body = (await request.json()) as IssueBody;
  } catch {
    return posError("invalid_request", 400);
  }

  const staffProfileId = body.staffProfileId?.trim() ?? "";
  if (!staffProfileId) {
    return posError("invalid_staff_profile_id", 400);
  }

  if (body.openingFloatCents == null || !Number.isFinite(body.openingFloatCents)) {
    return posError("invalid_opening_float_cents", 400);
  }

  const idempotencyKey = body.idempotencyKey?.trim() ?? "";
  if (!idempotencyKey) {
    return posError("idempotency_key_required", 400);
  }

  const result = await issueWaiterCashBag({
    restaurantId: auth.auth.restaurantId,
    staffProfileId,
    openingFloatCents: body.openingFloatCents,
    issuedByProfileId: auth.auth.userId,
    idempotencyKey,
  });

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson(result);
}
