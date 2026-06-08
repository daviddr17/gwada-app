import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  RestaurantFiscalOverview,
  RestaurantFiscalSignatureRow,
} from "@/lib/pos/restaurant-fiscal-overview-types";
import { fetchPlatformFiskalyConfigAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";

export type { RestaurantFiscalOverview, RestaurantFiscalSignatureRow };

export async function loadRestaurantFiscalOverview(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantFiscalOverview> {
  const platform = await fetchPlatformFiskalyConfigAdmin();

  const { data: config } = await sb
    .from("pos_restaurant_fiscal_config")
    .select(
      "fiskaly_enabled, fiskaly_tss_id, fiskaly_client_id, fiskaly_client_serial, fiskaly_provision_status, fiskaly_provision_error, fiskaly_provisioned_at, dsfinvk_cash_register_ready, register_opened_at, last_closing_at, last_closing_z_nr",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const { data: fiscalRows } = await sb
    .from("pos_fiscal_transactions")
    .select(
      "id, order_id, tx_id, tss_id, client_id, signature, signature_counter, signed_at, receipt_public_url, state, pos_orders(order_number)",
    )
    .eq("restaurant_id", restaurantId)
    .order("signed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const provisionStatus = config?.fiskaly_provision_status as
    | "pending"
    | "ready"
    | "failed"
    | null
    | undefined;

  const recentSignatures: RestaurantFiscalSignatureRow[] = (fiscalRows ?? []).map(
    (row) => {
      const orderJoin = row.pos_orders as { order_number?: number } | null;
      return {
        id: row.id as string,
        orderId: row.order_id as string,
        orderNumber:
          typeof orderJoin?.order_number === "number"
            ? orderJoin.order_number
            : null,
        txId: row.tx_id as string,
        tssId: row.tss_id as string,
        clientId: row.client_id as string,
        signature: row.signature as string,
        signatureCounter: row.signature_counter as number,
        signedAt: (row.signed_at as string | null) ?? null,
        receiptPublicUrl: (row.receipt_public_url as string | null) ?? null,
        state: row.state as string,
      };
    },
  );

  const hasConfig = Boolean(config);
  const tssId = config?.fiskaly_tss_id?.trim() || null;
  const clientId = config?.fiskaly_client_id?.trim() || null;

  return {
    configured: hasConfig && Boolean(tssId && clientId),
    fiskalyEnabled: Boolean(config?.fiskaly_enabled),
    provisionStatus: provisionStatus ?? null,
    provisionError: config?.fiskaly_provision_error ?? null,
    provisionedAt: config?.fiskaly_provisioned_at ?? null,
    tssId,
    clientId,
    clientSerial: config?.fiskaly_client_serial?.trim() || null,
    dsfinvkCashRegisterReady: Boolean(config?.dsfinvk_cash_register_ready),
    registerOpenedAt: config?.register_opened_at ?? null,
    lastClosingAt: config?.last_closing_at ?? null,
    lastClosingZNr:
      typeof config?.last_closing_z_nr === "number"
        ? config.last_closing_z_nr
        : null,
    platformEnabled: platform.enabled,
    platformEnv: platform.enabled ? platform.env : null,
    recentSignatures,
  };
}
