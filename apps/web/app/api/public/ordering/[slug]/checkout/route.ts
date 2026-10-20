import { NextResponse } from "next/server";
import { createGuestOrderCheckout } from "@/lib/ordering/create-guest-order-server";
import type { GuestCheckoutInput } from "@/lib/ordering/online-ordering-types";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  let body: GuestCheckoutInput & { redirectPathTemplate?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await createGuestOrderCheckout({
    slug,
    input: body,
    redirectPathTemplate: body.redirectPathTemplate,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    statusToken: result.statusToken,
    checkoutUrl: result.checkoutUrl,
    guestPaymentId: result.guestPaymentId,
    molliePaymentId: result.molliePaymentId,
    paymentMode: result.paymentMode,
    totalCents: result.totalCents,
    statusUrl: `/order/${slug}/status/${result.statusToken}`,
  });
}
