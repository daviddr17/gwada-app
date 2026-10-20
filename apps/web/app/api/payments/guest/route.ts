import { createRestaurantGuestPayment } from "@/lib/payments/create-guest-payment";
import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

/** Online Gast → Restaurant: Hosted Checkout oder Payment Link (Mollie Connect). */
export async function POST(request: Request) {
  let body: {
    restaurantId?: string;
    amountEuros?: number;
    description?: string;
    purpose?: "deposit" | "order" | "payment_link" | "generic";
    redirectUrl?: string;
    cancelUrl?: string;
    asPaymentLink?: boolean;
    metadata?: Record<string, string>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "restaurant_required" }, { status: 400 });
  }
  if (typeof body.amountEuros !== "number" || !(body.amountEuros > 0)) {
    return Response.json({ error: "invalid_amount" }, { status: 400 });
  }
  const description = body.description?.trim();
  if (!description) {
    return Response.json({ error: "description_required" }, { status: 400 });
  }
  const redirectUrl = body.redirectUrl?.trim();
  if (!redirectUrl) {
    return Response.json({ error: "redirect_required" }, { status: 400 });
  }

  const auth = await authorizeRestaurantModule(
    restaurantId,
    "integrations.mollie",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await createRestaurantGuestPayment({
    restaurantId,
    amountEuros: body.amountEuros,
    description,
    purpose: body.purpose,
    redirectUrl,
    cancelUrl: body.cancelUrl,
    asPaymentLink: body.asPaymentLink,
    metadata: body.metadata,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    ok: true,
    id: result.id,
    checkoutUrl: result.checkoutUrl,
    molliePaymentId: result.molliePaymentId,
    molliePaymentLinkId: result.molliePaymentLinkId,
  });
}
