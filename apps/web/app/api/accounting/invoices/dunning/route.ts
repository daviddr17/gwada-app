import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { createLexofficeDunningForInvoice } from "@/lib/integrations/lexoffice-dunnings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    invoiceId?: string;
  };

  const restaurantId = restaurantIdFromRequest(req, body);
  const invoiceId = body.invoiceId?.trim() ?? "";

  if (!isUuidRestaurantId(invoiceId)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await assertAccountingApi(restaurantId, "update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sb = await createSupabaseServerClient();
  const { data: invoice, error } = await sb
    .from("accounting_invoices")
    .select("id, source, external_id, status, voucher_number")
    .eq("restaurant_id", auth.restaurantId)
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !invoice) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  const row = invoice as {
    source: string;
    external_id: string | null;
    status: string;
    voucher_number: string | null;
  };

  if (row.source !== "lexoffice" || !row.external_id) {
    return NextResponse.json(
      { error: "Nur Lexware-Rechnungen können gemahnt werden." },
      { status: 400 },
    );
  }

  if (row.status !== "open" && row.status !== "overdue") {
    return NextResponse.json(
      { error: "Mahnung nur für offene Rechnungen möglich." },
      { status: 400 },
    );
  }

  const result = await createLexofficeDunningForInvoice(
    auth.restaurantId,
    row.external_id,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    dunningId: result.dunningId,
    voucherNumber: row.voucher_number,
  });
}
