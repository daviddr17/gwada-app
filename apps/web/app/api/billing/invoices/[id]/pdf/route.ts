import { buildBillingInvoicePdf } from "@/lib/billing/billing-invoice-pdf";
import { loadRestaurantBillingInvoiceForPdf } from "@/lib/billing/restaurant-invoices";
import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await ctx.params;
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
  if (
    !invoiceId?.trim() ||
    !restaurantId ||
    !isUuidRestaurantId(restaurantId)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeRestaurantModule(restaurantId, "billing.manage");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const invoice = await loadRestaurantBillingInvoiceForPdf({
    restaurantId,
    invoiceId: invoiceId.trim(),
  });
  if (!invoice) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  const { data: restaurant } = admin
    ? await admin
        .from("restaurants")
        .select("name")
        .eq("id", restaurantId)
        .maybeSingle()
    : { data: null };

  const pdf = await buildBillingInvoicePdf({
    number: invoice.number || invoice.id.slice(0, 8).toUpperCase(),
    restaurantName:
      typeof restaurant?.name === "string" && restaurant.name.trim()
        ? restaurant.name.trim()
        : "Restaurant",
    status: invoice.status,
    billingReason: invoice.billingReason,
    currency: invoice.currency,
    amountDueCents: invoice.amountDue,
    amountPaidCents: invoice.amountPaid,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    paidAt: invoice.paidAt,
    createdAt: invoice.createdAt,
    molliePaymentId: invoice.molliePaymentId,
  });

  const filename = `${(invoice.number || "gwada-abo").replace(/[^\w.-]+/g, "_")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
