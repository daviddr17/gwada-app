import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const FISCAL_SELECT =
  "id, tx_id, signature, signature_counter, signed_at, tss_id, client_id, custom_receipt_url, receipt_public_url, split_group";

export type OrderFiscalReceiptRow = {
  id: string;
  tx_id: string;
  signature: string;
  signature_counter: number;
  signed_at: string | null;
  tss_id: string;
  client_id: string;
  custom_receipt_url: string | null;
  receipt_public_url: string | null;
  split_group: string | null;
};

/**
 * Fiscal row for order-level receipt PDFs.
 * Full-order payments use split_group = null; session allocation payments store TSE on split_group = payment id.
 */
export async function loadFiscalForOrderReceipt(
  admin: SupabaseClient,
  orderId: string,
): Promise<OrderFiscalReceiptRow | null> {
  const { data: primary } = await admin
    .from("pos_fiscal_transactions")
    .select(FISCAL_SELECT)
    .eq("order_id", orderId)
    .is("split_group", null)
    .maybeSingle();

  if (primary?.signature) {
    return primary as OrderFiscalReceiptRow;
  }

  const { data: splitRows } = await admin
    .from("pos_fiscal_transactions")
    .select(FISCAL_SELECT)
    .eq("order_id", orderId)
    .not("split_group", "is", null)
    .not("signature", "is", null)
    .order("signed_at", { ascending: false, nullsFirst: false });

  const row = splitRows?.[0];
  return row ? (row as OrderFiscalReceiptRow) : null;
}
