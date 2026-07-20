import "server-only";

import { createAccountingInvoice } from "@/lib/accounting/accounting-invoices-server";
import { reindexLineItems } from "@/lib/accounting/compute-line-totals";
import type {
  AccountingInvoiceRow,
  AccountingLineItem,
  AccountingRecipientSnapshot,
  AccountingSalesDocumentInput,
} from "@/lib/types/accounting";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PosFormalInvoiceDraft = {
  paymentId: string;
  orderId: string;
  orderNumber: number;
  paidAt: string | null;
  amountCents: number;
  tipCents: number;
  method: string;
  currency: string;
  alreadyInvoiced: boolean;
  existingInvoiceId: string | null;
  existingInvoiceNumber: string | null;
  lineItems: AccountingLineItem[];
  suggestedRemark: string;
  suggestedIntroduction: string;
};

function eurosFromCents(cents: number): number {
  return Math.round(cents) / 100;
}

function mapAllocationsToLineItems(
  allocations: Array<{
    quantity: number;
    amount_cents: number;
    pos_order_lines:
      | {
          name?: string;
          unit_price_cents?: number;
          vat_rate?: number;
        }
      | {
          name?: string;
          unit_price_cents?: number;
          vat_rate?: number;
        }[]
      | null;
  }>,
): AccountingLineItem[] {
  return allocations.map((alloc, index) => {
    const nested = alloc.pos_order_lines;
    const line = Array.isArray(nested) ? nested[0] : nested;
    const qty = Number(alloc.quantity) || 1;
    const amountCents = Number(alloc.amount_cents) || 0;
    const unitFromLine = Number(line?.unit_price_cents ?? 0);
    const unitPrice =
      unitFromLine > 0
        ? eurosFromCents(unitFromLine)
        : eurosFromCents(Math.round(amountCents / Math.max(qty, 1)));
    const vat = Number(line?.vat_rate ?? 19);
    return {
      id: crypto.randomUUID(),
      sortOrder: index,
      type: "custom" as const,
      articleId: null,
      name: String(line?.name ?? "Position").trim() || "Position",
      description: null,
      quantity: qty,
      unitName: "Stk",
      unitPrice,
      taxRatePercent: vat,
      discountPercent: 0,
      lineAmount: eurosFromCents(amountCents),
    };
  });
}

export async function loadPosFormalInvoiceDraft(
  supabase: SupabaseClient,
  restaurantId: string,
  paymentId: string,
): Promise<{ draft: PosFormalInvoiceDraft | null; error: string | null }> {
  const admin = createSupabaseAdminClient() ?? supabase;

  const { data: payment, error: payError } = await admin
    .from("pos_payments")
    .select(
      "id, order_id, restaurant_id, method, status, amount_cents, tip_cents, paid_at, currency",
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (payError || !payment) {
    return { draft: null, error: "payment_not_found" };
  }
  if (payment.restaurant_id !== restaurantId) {
    return { draft: null, error: "forbidden" };
  }
  if (payment.status !== "paid") {
    return { draft: null, error: "payment_not_paid" };
  }

  const { data: existing } = await admin
    .from("accounting_invoices")
    .select("id, voucher_number")
    .eq("restaurant_id", restaurantId)
    .eq("pos_payment_id", paymentId)
    .maybeSingle();

  const { data: order } = await admin
    .from("pos_orders")
    .select("id, order_number")
    .eq("id", payment.order_id as string)
    .maybeSingle();

  const { data: allocations, error: allocError } = await admin
    .from("pos_payment_line_allocations")
    .select(
      "quantity, amount_cents, pos_order_lines(name, unit_price_cents, vat_rate)",
    )
    .eq("payment_id", paymentId);

  if (allocError) {
    return { draft: null, error: allocError.message };
  }

  let lineItems = mapAllocationsToLineItems(
    (allocations ?? []) as Parameters<typeof mapAllocationsToLineItems>[0],
  );

  if (lineItems.length === 0) {
    // Fallback: ganze Order-Zeilen (ältere Zahlungen ohne Allocations)
    const { data: lines } = await admin
      .from("pos_order_lines")
      .select("name, quantity, unit_price_cents, vat_rate, line_total_cents")
      .eq("order_id", payment.order_id as string)
      .order("position", { ascending: true });
    lineItems = (lines ?? []).map((line, index) => ({
      id: crypto.randomUUID(),
      sortOrder: index,
      type: "custom" as const,
      articleId: null,
      name: String(line.name ?? "Position").trim() || "Position",
      description: null,
      quantity: Number(line.quantity) || 1,
      unitName: "Stk",
      unitPrice: eurosFromCents(Number(line.unit_price_cents ?? 0)),
      taxRatePercent: Number(line.vat_rate ?? 19),
      discountPercent: 0,
      lineAmount: eurosFromCents(Number(line.line_total_cents ?? 0)),
    }));
  }

  const tipCents = Number(payment.tip_cents ?? 0);
  if (tipCents > 0) {
    lineItems.push({
      id: crypto.randomUUID(),
      sortOrder: lineItems.length,
      type: "custom",
      articleId: null,
      name: "Trinkgeld",
      description: null,
      quantity: 1,
      unitName: "Stk",
      unitPrice: eurosFromCents(tipCents),
      taxRatePercent: 0,
      discountPercent: 0,
      lineAmount: eurosFromCents(tipCents),
    });
  }

  lineItems = reindexLineItems(lineItems);
  const orderNumber = Number(order?.order_number ?? 0);

  return {
    draft: {
      paymentId: payment.id as string,
      orderId: payment.order_id as string,
      orderNumber,
      paidAt: (payment.paid_at as string | null) ?? null,
      amountCents: Number(payment.amount_cents ?? 0),
      tipCents,
      method: String(payment.method ?? ""),
      currency: String(payment.currency ?? "EUR"),
      alreadyInvoiced: Boolean(existing),
      existingInvoiceId: (existing?.id as string | null) ?? null,
      existingInvoiceNumber:
        (existing?.voucher_number as string | null) ?? null,
      lineItems,
      suggestedRemark: `POS-Bon #${orderNumber} · Zahlung ${payment.id}`,
      suggestedIntroduction:
        "Vielen Dank für Ihren Besuch. Wir erlauben uns, folgende Leistungen in Rechnung zu stellen.",
    },
    error: null,
  };
}

export async function createFormalInvoiceFromPosPayment(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  userId: string;
  paymentId: string;
  recipient: AccountingRecipientSnapshot;
  voucherDate?: string;
  dueDate?: string | null;
  email?: string | null;
  phone?: string | null;
}): Promise<{ row: AccountingInvoiceRow | null; error: string | null }> {
  const { draft, error: draftError } = await loadPosFormalInvoiceDraft(
    params.supabase,
    params.restaurantId,
    params.paymentId,
  );
  if (draftError || !draft) {
    return { row: null, error: draftError ?? "draft_failed" };
  }
  if (draft.alreadyInvoiced) {
    return {
      row: null,
      error: "Für diese Quittung existiert bereits eine formale Rechnung.",
    };
  }

  const name = params.recipient.name.trim();
  if (!name) {
    return { row: null, error: "Name oder Firmenname ist erforderlich." };
  }
  if (
    !params.recipient.street?.trim() ||
    !params.recipient.zip?.trim() ||
    !params.recipient.city?.trim()
  ) {
    return {
      row: null,
      error: "Straße, PLZ und Ort sind für eine formale Rechnung erforderlich.",
    };
  }

  const voucherDate =
    params.voucherDate?.trim() ||
    (draft.paidAt ? draft.paidAt.slice(0, 10) : new Date().toISOString().slice(0, 10));

  const recipient: AccountingRecipientSnapshot = {
    name: params.recipient.name.trim(),
    supplement: params.recipient.supplement?.trim() || null,
    street: params.recipient.street?.trim() || null,
    zip: params.recipient.zip?.trim() || null,
    city: params.recipient.city?.trim() || null,
    countryCode: params.recipient.countryCode?.trim() || "DE",
    email: params.email?.trim() || params.recipient.email?.trim() || null,
    phone: params.phone?.trim() || params.recipient.phone?.trim() || null,
  };

  const input: AccountingSalesDocumentInput = {
    recipientType: "one_time",
    contactId: null,
    recipient,
    voucherDate,
    dueDate: params.dueDate ?? null,
    currency: draft.currency || "EUR",
    taxMode: "gross",
    lineItems: draft.lineItems,
    title: `Rechnung zu POS-Bon #${draft.orderNumber}`,
    introduction: draft.suggestedIntroduction,
    remark: draft.suggestedRemark,
    syncToLexoffice: false,
    finalizeOnCreate: false,
    posPaymentId: draft.paymentId,
    posOrderId: draft.orderId,
  };

  return createAccountingInvoice(params.supabase, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    input,
  });
}
