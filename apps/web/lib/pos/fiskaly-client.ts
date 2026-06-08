import "server-only";

import {
  buildSignDeVatAmounts,
  type VatLineInput,
} from "@gwada/pos-domain";
import { formatCentsAsDecimal } from "@gwada/shared";
import { fiskalyAuthToken, normalizeFiskalySignDeBaseUrl } from "@/lib/pos/fiskaly-auth";
import { ensureRestaurantFiskalyProvisioned } from "@/lib/pos/fiskaly-provision";
import { fetchPlatformFiskalySecretsAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SignOrderInput = {
  orderId: string;
  restaurantId: string;
  totalCents: number;
  tipCents: number;
  lines: Array<{
    name: string;
    lineTotalCents: number;
    vatRate: number;
  }>;
  paymentType: "CASH" | "NON_CASH";
};

type FiskalySignResult =
  | {
      ok: true;
      txId: string;
      signature: string;
      signatureCounter: number;
      txRevision: number;
      tssId: string;
      clientId: string;
    }
  | { ok: false; error: string };

export async function signPosOrderWithFiskaly(
  input: SignOrderInput,
): Promise<FiskalySignResult> {
  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled) {
    return { ok: false, error: "fiskaly_not_configured" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

  let { data: fiscal, error: fiscalError } = await admin
    .from("pos_restaurant_fiscal_config")
    .select("fiskaly_enabled, fiskaly_tss_id, fiskaly_client_id")
    .eq("restaurant_id", input.restaurantId)
    .maybeSingle();

  let tssId = fiscal?.fiskaly_tss_id?.trim();
  let clientId = fiscal?.fiskaly_client_id?.trim();

  if (
    fiscalError ||
    !fiscal?.fiskaly_enabled ||
    !tssId ||
    !clientId
  ) {
    const provisioned = await ensureRestaurantFiskalyProvisioned(
      input.restaurantId,
    );
    if (!provisioned.ok) {
      return {
        ok: false,
        error: provisioned.error || "fiskaly_not_enabled_for_restaurant",
      };
    }

    const reload = await admin
      .from("pos_restaurant_fiscal_config")
      .select("fiskaly_enabled, fiskaly_tss_id, fiskaly_client_id")
      .eq("restaurant_id", input.restaurantId)
      .maybeSingle();

    fiscal = reload.data;
    fiscalError = reload.error;
    tssId = fiscal?.fiskaly_tss_id?.trim();
    clientId = fiscal?.fiskaly_client_id?.trim();
  }

  if (fiscalError || !fiscal?.fiskaly_enabled || !tssId || !clientId) {
    return { ok: false, error: "fiskaly_tss_missing" };
  }

  if (!platform.apiKey || !platform.apiSecret) {
    return { ok: false, error: "fiskaly_not_configured" };
  }

  try {
    const token = await fiskalyAuthToken(
      platform.signDeBaseUrl,
      platform.apiKey,
      platform.apiSecret,
    );
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const signBase = normalizeFiskalySignDeBaseUrl(platform.signDeBaseUrl);
    const txId = input.orderId;

    const activeRes = await fetch(
      `${signBase}/tss/${tssId}/tx/${txId}?tx_revision=1`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({ state: "ACTIVE", client_id: clientId }),
      },
    );
    if (!activeRes.ok) {
      const body = await activeRes.text();
      throw new Error(`Fiskaly ACTIVE failed: ${body}`);
    }

    const vatItems: VatLineInput[] = input.lines.map((line) => ({
      totalCents: line.lineTotalCents,
      vatRate: line.vatRate,
    }));
    const vatAmounts = buildSignDeVatAmounts(vatItems);
    const totalAmount = formatCentsAsDecimal(
      input.totalCents + input.tipCents,
    );

    const finishBody = {
      state: "FINISHED",
      client_id: clientId,
      schema: {
        standard_v1: {
          receipt: {
            receipt_type: "RECEIPT",
            amounts_per_vat_rate: vatAmounts,
            amounts_per_payment_type: [
              {
                payment_type: input.paymentType,
                currency_code: "EUR",
                amount: totalAmount,
              },
            ],
          },
        },
      },
    };

    const finishRes = await fetch(
      `${signBase}/tss/${tssId}/tx/${txId}?tx_revision=2`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify(finishBody),
      },
    );

    if (!finishRes.ok) {
      const body = await finishRes.text();
      throw new Error(`Fiskaly FINISHED failed: ${body}`);
    }

    const signed = (await finishRes.json()) as {
      revision?: number;
      signature?: { value?: string; counter?: number };
    };

    const signature = signed.signature?.value;
    const signatureCounter = signed.signature?.counter;
    if (!signature || signatureCounter == null) {
      throw new Error("Fiskaly response missing signature");
    }

    return {
      ok: true,
      txId,
      signature,
      signatureCounter,
      txRevision: signed.revision ?? 2,
      tssId,
      clientId,
    };
  } catch (err) {
    console.error("[pos] Fiskaly sign", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "fiskaly_sign_failed",
    };
  }
}

export async function persistFiskalyTransaction(params: {
  restaurantId: string;
  orderId: string;
  txId: string;
  tssId: string;
  clientId: string;
  txRevision: number;
  signature: string;
  signatureCounter: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

  const { error } = await admin.from("pos_fiscal_transactions").upsert(
    {
      restaurant_id: params.restaurantId,
      order_id: params.orderId,
      tx_id: params.txId,
      tss_id: params.tssId,
      client_id: params.clientId,
      tx_revision: params.txRevision,
      signature: params.signature,
      signature_counter: params.signatureCounter,
      state: "FINISHED",
      signed_at: new Date().toISOString(),
    },
    { onConflict: "tx_id" },
  );

  if (error) {
    console.error("[pos] persist fiskaly tx", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
