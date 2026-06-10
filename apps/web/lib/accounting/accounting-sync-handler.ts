import "server-only";

import { getAccountingConnector } from "@/lib/accounting/connectors/registry";
import type { ConnectorSyncResult } from "@/lib/accounting/connectors/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function runAccountingSync(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    scope: "sales" | "vouchers";
    kind?: "invoice" | "quotation";
    force?: boolean;
  },
): Promise<ConnectorSyncResult> {
  const connector = await getAccountingConnector(params.restaurantId);

  if (params.scope === "sales") {
    if (!connector.capabilities.canSyncSales) {
      return {
        imported: 0,
        updated: 0,
        skipped: true,
        error: "Kein Connector für Rechnungen/Angebote konfiguriert.",
      };
    }
    const kind = params.kind === "quotation" ? "quotation" : "invoice";
    return connector.syncSalesDocuments(sb, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      kind,
      force: params.force,
    });
  }

  if (!connector.capabilities.canSyncVouchers) {
    return {
      imported: 0,
      updated: 0,
      skipped: true,
      error: "Kein Connector für Belege konfiguriert.",
    };
  }

  return connector.syncVouchers(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    force: params.force,
  });
}
