import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildPosReceiptPdfBuffer,
  type ReceiptFiskalyInput,
  type ReceiptOrderInput,
  type ReceiptRestaurantInput,
} from "@/lib/pos/receipt-pdf";
import { uploadPosReceiptPdf } from "@/lib/pos/receipt-storage";

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
    { data: fiscal },
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
    admin
      .from("pos_fiscal_transactions")
      .select(
        "tx_id, signature, signature_counter, signed_at, tss_id, client_id",
      )
      .eq("order_id", orderId)
      .is("split_group", null)
      .maybeSingle(),
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

  if (fiscal) {
    await admin
      .from("pos_fiscal_transactions")
      .update({ custom_receipt_url: storagePath })
      .eq("order_id", orderId)
      .is("split_group", null);
  }

  return storagePath;
}
