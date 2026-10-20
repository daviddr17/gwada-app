import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  markGuestOrderPaidByOrderId,
  loadGuestOrderStatusByToken,
} from "@/lib/ordering/create-guest-order-server";
import { recheckMolliePosPayment } from "@/lib/pos/mollie-pos-payment";

export const dynamic = "force-dynamic";

/** Poll terminal / hosted payment for a guest order (by status token + mollie id). */
export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  let body: { molliePaymentId?: string };
  try {
    body = (await request.json()) as { molliePaymentId?: string };
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const molliePaymentId = body.molliePaymentId?.trim() ?? "";
  if (!molliePaymentId.startsWith("tr_")) {
    return NextResponse.json({ error: "invalid_payment" }, { status: 400 });
  }

  const status = await loadGuestOrderStatusByToken(token);
  if (!status.ok) {
    return NextResponse.json(
      { error: status.error },
      { status: status.status },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 503 },
    );
  }

  const { data: order } = await admin
    .from("pos_orders")
    .select("id, restaurant_id, status")
    .eq("guest_status_token", token.trim())
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (order.status !== "pending_payment") {
    return NextResponse.json({
      paid: true,
      orderStatus: order.status,
    });
  }

  const recheck = await recheckMolliePosPayment({
    restaurantId: order.restaurant_id as string,
    molliePaymentId,
  });

  if (recheck.ok && recheck.paid) {
    await markGuestOrderPaidByOrderId(order.id as string);
    return NextResponse.json({ paid: true, orderStatus: "received" });
  }

  return NextResponse.json({
    paid: false,
    mollieStatus: recheck.ok ? recheck.status : "unknown",
    error: recheck.ok ? null : recheck.error,
  });
}
