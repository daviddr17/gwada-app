import { assertAccountingApi } from "@/lib/accounting/assert-accounting-api";
import { stornoFormalInvoiceForPosPayment } from "@/lib/pos/pos-formal-invoice-storno-server";
import { posError, posJson } from "@/lib/pos/pos-responses";
import { authorizePosRestaurant } from "@/lib/pos/pos-route-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type Body = {
  restaurantId?: string;
};

/**
 * Explizites Storno einer formalen Rechnung zur POS-Zahlung
 * (ohne Barstorno — z. B. Karte / nachträgliche Korrektur).
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
  const posAuth = await authorizePosRestaurant(request, restaurantId);
  if (!posAuth.ok) return posError(posAuth.error, posAuth.status);

  const accounting = await assertAccountingApi(
    posAuth.auth.restaurantId,
    "create",
  );
  if (!accounting.ok) {
    return posError(accounting.error, accounting.status);
  }

  // Admin-Client im Helper (RLS: accounting.manage); Create-Recht wurde oben geprüft.
  const result = await stornoFormalInvoiceForPosPayment({
    restaurantId: posAuth.auth.restaurantId,
    paymentId,
    userId: accounting.userId,
    remarkSuffix: "Manuelles Rechnungsstorno (POS).",
  });

  if (!result.ok) {
    return posError(result.error, 400);
  }
  if (result.mode === "none") {
    return posError("no_formal_invoice", 404);
  }
  return posJson({ storno: result });
}
