import {
  deleteCustomPosPaymentMethod,
  updatePosPaymentMethod,
} from "@/lib/pos/pos-payment-methods-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type PatchBody = {
  restaurantId?: string;
  label?: string;
  isActive?: boolean;
  sortOrder?: number;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
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

  const result = await updatePosPaymentMethod(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
    id,
    {
      label: body.label,
      is_active: body.isActive,
      sort_order: body.sortOrder,
    },
  );

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({ method: result.method });
}

type DeleteBody = {
  restaurantId?: string;
};

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: DeleteBody = {};
  try {
    body = (await request.json()) as DeleteBody;
  } catch {
    const url = new URL(request.url);
    body = { restaurantId: url.searchParams.get("restaurantId") ?? undefined };
  }

  const authResult = await authorizePosRestaurant(
    request,
    body.restaurantId ?? null,
  );
  if (!authResult.ok) {
    return posError(authResult.error, authResult.status);
  }

  const result = await deleteCustomPosPaymentMethod(
    authResult.auth.supabase,
    authResult.auth.restaurantId,
    id,
  );

  if (!result.ok) {
    return posError(result.error, result.status);
  }

  return posJson({ ok: true });
}
