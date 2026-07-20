import { stornoFormalInvoiceForPosPayment } from "@/lib/pos/pos-formal-invoice-storno-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurantPermission } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type Body = {
  restaurantId?: string;
};

/**
 * Explizites Storno einer formalen Rechnung — Web und iPad-Hub (PIN-Session).
 * Recht: accounting.create
 */
export async function POST(request: Request, context: RouteContext) {
  const { id: paymentId } = await context.params;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return posError("invalid_request", 400);
  }

  const restaurantId = body.restaurantId ?? null;
  const posAuth = await authorizePosRestaurantPermission(
    request,
    restaurantId,
    "accounting.create",
  );
  if (!posAuth.ok) return posError(posAuth.error, posAuth.status);

  const result = await stornoFormalInvoiceForPosPayment({
    restaurantId: posAuth.auth.restaurantId,
    paymentId,
    userId: posAuth.auth.userId,
    remarkSuffix: "Manuelles Rechnungsstorno (POS-Hub).",
  });

  if (!result.ok) {
    return posError(result.error, 400);
  }
  if (result.mode === "none") {
    return posError("no_formal_invoice", 404);
  }
  return posJson({ storno: result });
}
