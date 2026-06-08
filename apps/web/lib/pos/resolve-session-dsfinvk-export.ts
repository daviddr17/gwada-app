import "server-only";

import {
  downloadDsfinvkExport,
  dsfinvkBusinessDateFromClose,
  fetchDsfinvkExportZip,
  listDsfinvkExports,
  normalizeExportState,
} from "@/lib/pos/fiskaly-dsfinvk-export";
import { fetchPlatformFiskalySecretsAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Runtime-only: fetch DSFinV-K ZIP from Fiskaly (no server-side storage). */
export async function resolveSessionDsfinvkZip(params: {
  restaurantId: string;
  closedAt: string;
  cashPointClosingId?: string | null;
  businessDate?: string | null;
}): Promise<
  | { ok: true; buffer: Buffer; exportId: string; source: string }
  | { ok: false; error: string }
> {
  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled || !platform.apiKey || !platform.apiSecret) {
    return { ok: false, error: "fiskaly_not_configured" };
  }

  const admin = createSupabaseAdminClient();
  const { data: config } = admin
    ? await admin
        .from("pos_restaurant_fiscal_config")
        .select("fiskaly_client_id")
        .eq("restaurant_id", params.restaurantId)
        .maybeSingle()
    : { data: null };

  const clientId = config?.fiskaly_client_id?.trim();
  if (!clientId) {
    return { ok: false, error: "fiscal_config_not_found" };
  }

  const fiskalyBase = {
    dsfinvkBaseUrl: platform.dsfinvkBaseUrl,
    apiKey: platform.apiKey,
    apiSecret: platform.apiSecret,
  };

  const businessDate =
    params.businessDate?.trim() || dsfinvkBusinessDateFromClose(params.closedAt);

  const listed = await listDsfinvkExports({
    ...fiskalyBase,
    clientId,
    businessDateStart: businessDate,
    businessDateEnd: businessDate,
    states: "COMPLETED",
  });

  if (listed.ok && listed.exports.length > 0) {
    const closingId = params.cashPointClosingId?.trim()?.toLowerCase();
    const completed = listed.exports.filter(
      (e) => normalizeExportState(e.state) === "COMPLETED" && e._id,
    );
    const match =
      (closingId
        ? completed.find((e) =>
            e.cash_point_closings?.some(
              (c) => c.toLowerCase() === closingId,
            ),
          )
        : null) ?? completed[0];

    const exportId = match?._id?.trim();
    if (exportId) {
      const dl = await downloadDsfinvkExport({
        ...fiskalyBase,
        exportId,
      });
      if (dl.ok) {
        return { ok: true, buffer: dl.buffer, exportId, source: "fiskaly_list" };
      }
    }
  }

  const created = await fetchDsfinvkExportZip({
    ...fiskalyBase,
    clientId,
    businessDate,
  });

  if (!created.ok) {
    return { ok: false, error: created.error };
  }

  return {
    ok: true,
    buffer: created.buffer,
    exportId: created.exportId,
    source: "fiskaly_trigger",
  };
}
