import "server-only";

import { buildEkabsVatAmounts } from "@gwada/pos-domain";
import { formatCentsAsDecimal } from "@gwada/shared";
import { fetchPlatformFiskalySecretsAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

let cachedEReceiptToken: { value: string; expiresAt: number } | null = null;

function normalizeEReceiptBaseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

async function eReceiptAuthToken(
  eReceiptBaseUrl: string,
  apiKey: string,
  apiSecret: string,
): Promise<string> {
  const now = Date.now();
  if (cachedEReceiptToken && cachedEReceiptToken.expiresAt - now > 60_000) {
    return cachedEReceiptToken.value;
  }

  const base = normalizeEReceiptBaseUrl(eReceiptBaseUrl);
  const res = await fetch(`${base}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`eReceipt auth failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    access_token_expires_in: number;
  };

  cachedEReceiptToken = {
    value: data.access_token,
    expiresAt: now + data.access_token_expires_in * 1000,
  };
  return data.access_token;
}

export async function tryCreateEReceiptForOrder(
  orderId: string,
): Promise<{ ok: true; receiptPublicUrl: string } | { ok: false }> {
  try {
    const receiptPublicUrl = await createEReceiptForOrder(orderId);
    return { ok: true, receiptPublicUrl };
  } catch (err) {
    console.warn(
      "[pos] eReceipt creation failed (non-fatal):",
      err instanceof Error ? err.message : err,
    );
    return { ok: false };
  }
}

async function createEReceiptForOrder(orderId: string): Promise<string> {
  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled || !platform.apiKey || !platform.apiSecret) {
    throw new Error("fiskaly_not_configured");
  }

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("admin_unavailable");

  const { data: order, error: orderError } = await admin
    .from("pos_orders")
    .select("id, order_number, total_cents, tip_cents")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) throw new Error("order_not_found");

  const [{ data: lines }, { data: fiscal }, { data: payments }] =
    await Promise.all([
      admin
        .from("pos_order_lines")
        .select("name, quantity, unit_price_cents, line_total_cents, vat_rate")
        .eq("order_id", orderId)
        .order("position"),
      admin
        .from("pos_fiscal_transactions")
        .select("tx_id, tss_id, client_id, signature, signature_counter")
        .eq("order_id", orderId)
        .is("split_group", null)
        .maybeSingle(),
      admin
        .from("pos_payments")
        .select("method, status")
        .eq("order_id", orderId)
        .eq("status", "paid"),
    ]);

  if (!fiscal?.tx_id) throw new Error("fiskaly_tx_missing");

  const totalCents = Number(order.total_cents) + Number(order.tip_cents);
  const totalAmount = formatCentsAsDecimal(totalCents);

  const hasCash = (payments ?? []).some((p) => p.method === "cash");
  const paymentTypeName = hasCash ? "CASH" : "NON_CASH";

  const receiptBody = {
    schema: {
      ekabs_v0: {
        head: {
          number: String(order.order_number).padStart(8, "0").slice(-8),
          date: Math.floor(Date.now() / 1000),
        },
        data: {
          currency: "EUR",
          full_amount_incl_vat: totalAmount,
          payment_types: [{ name: paymentTypeName, amount: totalAmount }],
          lines: (lines ?? []).map((item) => ({
            text: `${item.quantity}× ${item.name}`,
            item: {
              number: item.name,
              quantity: Number(item.quantity).toFixed(2),
              price_per_unit: formatCentsAsDecimal(
                Number(item.unit_price_cents),
              ),
              full_amount: formatCentsAsDecimal(Number(item.line_total_cents)),
            },
          })),
          vat_amounts: buildEkabsVatAmounts(
            (lines ?? []).map((item) => ({
              totalCents: Number(item.line_total_cents),
              vatRate: Number(item.vat_rate),
            })),
          ),
        },
      },
    },
  };

  const token = await eReceiptAuthToken(
    platform.eReceiptBaseUrl,
    platform.apiKey,
    platform.apiSecret,
  );

  const base = normalizeEReceiptBaseUrl(platform.eReceiptBaseUrl);
  const eReceiptUrl = `${base}/receipt/${fiscal.tx_id}`;

  const res = await fetch(eReceiptUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(receiptBody),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`eReceipt PUT failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as {
    _id?: string;
    public_link?: { href?: string };
    assets?: { pdf_link?: string };
  };

  const receiptPublicUrl =
    data.public_link?.href ?? data.assets?.pdf_link ?? "";

  if (!receiptPublicUrl) {
    throw new Error("eReceipt response missing public URL");
  }

  const { error: updateError } = await admin
    .from("pos_fiscal_transactions")
    .update({
      fiskaly_receipt_id: data._id ?? null,
      receipt_public_url: receiptPublicUrl,
    })
    .eq("tx_id", fiscal.tx_id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return receiptPublicUrl;
}
