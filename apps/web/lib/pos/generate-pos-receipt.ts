import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildPosReceiptPdfBuffer,
  type ReceiptFiskalyInput,
  type ReceiptOrderInput,
  type ReceiptRestaurantInput,
} from "@/lib/pos/receipt-pdf";
import { loadFiscalForOrderReceipt } from "@/lib/pos/order-fiscal-for-receipt";
import {
  uploadPosPaymentReceiptPdf,
  uploadPosReceiptPdf,
} from "@/lib/pos/receipt-storage";

function formatRestaurantAddress(row: {
  address_line1: string | null;
  postal_code: string | null;
  city: string | null;
}): string | null {
  const street = row.address_line1?.trim();
  const cityLine = [row.postal_code, row.city].filter(Boolean).join(" ").trim();
  const parts = [street, cityLine || null].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export async function tryGeneratePosReceipt(
  orderId: string,
  options?: { force?: boolean },
): Promise<{ ok: true; storagePath: string } | { ok: false }> {
  try {
    const storagePath = await generatePosReceipt(orderId, options);
    return { ok: true, storagePath };
  } catch (err) {
    console.error(
      "[pos] Custom receipt generation failed (non-fatal):",
      err instanceof Error ? (err.stack ?? err.message) : err,
    );
    return { ok: false };
  }
}

export async function regeneratePosOrderReceipt(
  orderId: string,
): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
  const result = await tryGeneratePosReceipt(orderId, { force: true });
  if (!result.ok) {
    return { ok: false, error: "receipt_generation_failed" };
  }
  return result;
}

async function generatePosReceipt(
  orderId: string,
  options?: { force?: boolean },
): Promise<string> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("admin_unavailable");

  const { data: order, error: orderError } = await admin
    .from("pos_orders")
    .select(
      "id, restaurant_id, table_session_id, subtotal_cents, tip_cents, total_cents, created_at, created_by_profile_id, receipt_url",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("order_not_found");
  }

  if (!options?.force && order.receipt_url?.trim()) {
    return order.receipt_url.trim();
  }

  const [
    { data: lines },
    { data: payments },
    fiscal,
    { data: session },
    { data: restaurant },
  ] = await Promise.all([
    admin
      .from("pos_order_lines")
      .select("name, quantity, unit_price_cents, line_total_cents, vat_rate")
      .eq("order_id", orderId)
      .order("position"),
    admin
      .from("pos_payments")
      .select("method, amount_cents, received_amount_cents, status")
      .eq("order_id", orderId)
      .eq("status", "paid"),
    loadFiscalForOrderReceipt(admin, orderId),
    admin
      .from("pos_table_sessions")
      .select("dining_table_id")
      .eq("id", order.table_session_id)
      .maybeSingle(),
    admin
      .from("restaurants")
      .select(
        "name, address_line1, postal_code, city, phone, website, vat_number, receipt_footer, social_handle",
      )
      .eq("id", order.restaurant_id)
      .maybeSingle(),
  ]);

  if (!restaurant) throw new Error("restaurant_not_found");

  let tableLabel = "—";
  let areaName: string | null = null;
  if (session?.dining_table_id) {
    const { data: table } = await admin
      .from("dining_tables")
      .select("table_name, table_number, area_id")
      .eq("id", session.dining_table_id)
      .maybeSingle();

    if (table) {
      if (table.area_id) {
        const { data: area } = await admin
          .from("dining_areas")
          .select("name")
          .eq("id", table.area_id)
          .maybeSingle();
        areaName = area?.name?.trim() ?? null;
      }
      tableLabel =
        table.table_name?.trim() || `Tisch ${table.table_number}`;
    }
  }

  let staffName: string | null = null;
  if (order.created_by_profile_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", order.created_by_profile_id)
      .maybeSingle();
    staffName = profile?.display_name?.trim() ?? null;
  }

  const receiptOrder: ReceiptOrderInput = {
    id: order.id,
    createdAt: new Date(order.created_at),
    subtotalCents: Number(order.subtotal_cents),
    tipCents: Number(order.tip_cents),
    totalCents: Number(order.total_cents),
    items: (lines ?? []).map((line) => ({
      quantity: Number(line.quantity),
      name: line.name,
      unitPriceCents: Number(line.unit_price_cents),
      lineTotalCents: Number(line.line_total_cents),
      vatRate: Number(line.vat_rate),
    })),
    payments: (payments ?? []).map((p) => ({
      method: p.method,
      amountCents: Number(p.amount_cents),
      receivedAmountCents:
        p.received_amount_cents == null
          ? null
          : Number(p.received_amount_cents),
    })),
    tableLabel,
    staffName,
  };

  const receiptRestaurant: ReceiptRestaurantInput = {
    name: restaurant.name,
    areaName,
    addressLine: formatRestaurantAddress(restaurant),
    phone: restaurant.phone,
    vatNumber: restaurant.vat_number?.trim() || null,
    receiptFooter: restaurant.receipt_footer?.trim() || null,
    website: restaurant.website?.trim() || null,
    socialHandle: restaurant.social_handle?.trim() || null,
  };

  let fiskalyTx: ReceiptFiskalyInput | null = null;
  if (fiscal?.signature) {
    fiskalyTx = {
      txId: fiscal.tx_id,
      signature: fiscal.signature,
      signatureCounter: fiscal.signature_counter,
      signedAt: fiscal.signed_at ? new Date(fiscal.signed_at) : null,
      tssId: fiscal.tss_id,
      clientId: fiscal.client_id,
    };
  }

  const buffer = await buildPosReceiptPdfBuffer(
    receiptOrder,
    fiskalyTx,
    receiptRestaurant,
  );

  const storagePath = await uploadPosReceiptPdf(
    order.restaurant_id,
    order.id,
    buffer,
  );

  const { error: orderUpdateError } = await admin
    .from("pos_orders")
    .update({ receipt_url: storagePath })
    .eq("id", orderId);

  if (orderUpdateError) {
    throw new Error(orderUpdateError.message);
  }

  if (fiscal?.id) {
    await admin
      .from("pos_fiscal_transactions")
      .update({ custom_receipt_url: storagePath })
      .eq("id", fiscal.id);
  }

  return storagePath;
}

export async function tryGeneratePosPaymentReceipt(
  paymentId: string,
  options?: { force?: boolean },
): Promise<{ ok: true; storagePath: string } | { ok: false }> {
  try {
    const storagePath = await generatePosPaymentReceipt(paymentId, options);
    return { ok: true, storagePath };
  } catch (err) {
    console.error(
      "[pos] Payment receipt generation failed (non-fatal):",
      err instanceof Error ? (err.stack ?? err.message) : err,
    );
    return { ok: false };
  }
}

async function generatePosPaymentReceipt(
  paymentId: string,
  options?: { force?: boolean },
): Promise<string> {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("admin_unavailable");

  const { data: payment, error: payError } = await admin
    .from("pos_payments")
    .select(
      "id, restaurant_id, order_id, amount_cents, tip_cents, received_amount_cents, method, status, paid_at, created_at, split_group",
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (payError || !payment) {
    throw new Error("payment_not_found");
  }

  if (payment.status !== "paid") {
    throw new Error("payment_not_paid");
  }

  const splitGroup = (payment.split_group as string | null) ?? paymentId;

  const { data: fiscal } = await admin
    .from("pos_fiscal_transactions")
    .select(
      "id, tx_id, signature, signature_counter, signed_at, tss_id, client_id, custom_receipt_url",
    )
    .eq("split_group", splitGroup)
    .maybeSingle();

  if (!options?.force && fiscal?.custom_receipt_url?.trim()) {
    return fiscal.custom_receipt_url.trim();
  }

  const { data: allocations, error: allocError } = await admin
    .from("pos_payment_line_allocations")
    .select(
      "quantity, amount_cents, pos_order_lines(name, unit_price_cents, vat_rate)",
    )
    .eq("payment_id", paymentId);

  if (allocError) {
    throw new Error(allocError.message);
  }

  if (!allocations?.length) {
    throw new Error("payment_has_no_allocations");
  }

  const { data: order, error: orderError } = await admin
    .from("pos_orders")
    .select(
      "id, restaurant_id, table_session_id, created_by_profile_id",
    )
    .eq("id", payment.order_id as string)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("order_not_found");
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select(
      "name, address_line1, postal_code, city, phone, website, vat_number, receipt_footer, social_handle",
    )
    .eq("id", order.restaurant_id)
    .maybeSingle();

  if (!restaurant) throw new Error("restaurant_not_found");

  const { data: session } = await admin
    .from("pos_table_sessions")
    .select("dining_table_id")
    .eq("id", order.table_session_id)
    .maybeSingle();

  let tableLabel = "—";
  let areaName: string | null = null;
  if (session?.dining_table_id) {
    const { data: table } = await admin
      .from("dining_tables")
      .select("table_name, table_number, area_id")
      .eq("id", session.dining_table_id)
      .maybeSingle();

    if (table) {
      if (table.area_id) {
        const { data: area } = await admin
          .from("dining_areas")
          .select("name")
          .eq("id", table.area_id)
          .maybeSingle();
        areaName = area?.name?.trim() ?? null;
      }
      tableLabel =
        table.table_name?.trim() || `Tisch ${table.table_number}`;
    }
  }

  let staffName: string | null = null;
  if (order.created_by_profile_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", order.created_by_profile_id)
      .maybeSingle();
    staffName = profile?.display_name?.trim() ?? null;
  }

  const items = allocations.map((a) => {
    const nested = a.pos_order_lines;
    const line = Array.isArray(nested) ? nested[0] : nested;
    const qty = Number(a.quantity);
    const lineTotalCents = Number(a.amount_cents);
    const unitPriceCents =
      qty > 0
        ? Math.round(lineTotalCents / qty)
        : Number(line?.unit_price_cents ?? 0);
    return {
      quantity: qty,
      name: line?.name ?? "Position",
      unitPriceCents,
      lineTotalCents,
      vatRate: Number(line?.vat_rate ?? 19),
    };
  });

  const subtotalCents = items.reduce((s, i) => s + i.lineTotalCents, 0);
  const tipCents = Math.max(0, Number(payment.tip_cents));
  const totalCents = Number(payment.amount_cents);
  const paidAt = payment.paid_at ?? payment.created_at;

  const receiptOrder: ReceiptOrderInput = {
    id: paymentId,
    createdAt: new Date(paidAt as string),
    subtotalCents,
    tipCents,
    totalCents,
    items,
    payments: [
      {
        method: payment.method as string,
        amountCents: totalCents,
        receivedAmountCents:
          payment.received_amount_cents == null
            ? null
            : Number(payment.received_amount_cents),
      },
    ],
    tableLabel,
    staffName,
  };

  const receiptRestaurant: ReceiptRestaurantInput = {
    name: restaurant.name,
    areaName,
    addressLine: formatRestaurantAddress(restaurant),
    phone: restaurant.phone,
    vatNumber: restaurant.vat_number?.trim() || null,
    receiptFooter: restaurant.receipt_footer?.trim() || null,
    website: restaurant.website?.trim() || null,
    socialHandle: restaurant.social_handle?.trim() || null,
  };

  let fiskalyTx: ReceiptFiskalyInput | null = null;
  if (fiscal?.signature) {
    fiskalyTx = {
      txId: fiscal.tx_id,
      signature: fiscal.signature,
      signatureCounter: fiscal.signature_counter,
      signedAt: fiscal.signed_at ? new Date(fiscal.signed_at) : null,
      tssId: fiscal.tss_id,
      clientId: fiscal.client_id,
    };
  }

  const buffer = await buildPosReceiptPdfBuffer(
    receiptOrder,
    fiskalyTx,
    receiptRestaurant,
  );

  const storagePath = await uploadPosPaymentReceiptPdf(
    payment.restaurant_id as string,
    paymentId,
    buffer,
  );

  if (fiscal) {
    await admin
      .from("pos_fiscal_transactions")
      .update({ custom_receipt_url: storagePath })
      .eq("id", fiscal.id);
  }

  return storagePath;
}
