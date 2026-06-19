import "server-only";

import { connectorAutoSyncEnabled } from "@/lib/accounting/accounting-connector-settings";
import { getAccountingSettings } from "@/lib/accounting/accounting-settings-server";
import { runAccountingSync } from "@/lib/accounting/accounting-sync-handler";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountingLexofficeSyncCronStats = {
  restaurants: number;
  vouchersImported: number;
  vouchersUpdated: number;
  invoicesImported: number;
  invoicesUpdated: number;
  quotationsImported: number;
  quotationsUpdated: number;
  skippedRuns: number;
  errors: string[];
};

/** Cron: Lexoffice → DB (Belege, Rechnungen, Angebote), nur bei Auto-Sync an. */
export async function runAccountingLexofficeSyncCron(
  admin: SupabaseClient,
): Promise<AccountingLexofficeSyncCronStats> {
  const stats: AccountingLexofficeSyncCronStats = {
    restaurants: 0,
    vouchersImported: 0,
    vouchersUpdated: 0,
    invoicesImported: 0,
    invoicesUpdated: 0,
    quotationsImported: 0,
    quotationsUpdated: 0,
    skippedRuns: 0,
    errors: [],
  };

  const { data: integrations, error } = await admin
    .from("restaurant_integrations")
    .select("restaurant_id")
    .eq("integration_key", "lexoffice")
    .eq("status", "working");

  if (error) {
    stats.errors.push(`integrations:${error.message}`);
    return stats;
  }

  for (const row of integrations ?? []) {
    const restaurantId = (row as { restaurant_id: string }).restaurant_id;
    const settings = await getAccountingSettings(admin, restaurantId);
    if (!connectorAutoSyncEnabled(settings.connector_settings, "lexoffice")) {
      continue;
    }

    stats.restaurants += 1;
    const base = {
      restaurantId,
      userId: "",
      force: false as const,
    };

    const vouchers = await runAccountingSync(admin, {
      ...base,
      scope: "vouchers",
    });
    if (vouchers.error) {
      stats.errors.push(`${restaurantId}:vouchers:${vouchers.error}`);
    } else if (vouchers.skipped) {
      stats.skippedRuns += 1;
    } else {
      stats.vouchersImported += vouchers.imported;
      stats.vouchersUpdated += vouchers.updated;
    }

    const invoices = await runAccountingSync(admin, {
      ...base,
      scope: "sales",
      kind: "invoice",
    });
    if (invoices.error) {
      stats.errors.push(`${restaurantId}:invoices:${invoices.error}`);
    } else if (invoices.skipped) {
      stats.skippedRuns += 1;
    } else {
      stats.invoicesImported += invoices.imported;
      stats.invoicesUpdated += invoices.updated;
    }

    const quotations = await runAccountingSync(admin, {
      ...base,
      scope: "sales",
      kind: "quotation",
    });
    if (quotations.error) {
      stats.errors.push(`${restaurantId}:quotations:${quotations.error}`);
    } else if (quotations.skipped) {
      stats.skippedRuns += 1;
    } else {
      stats.quotationsImported += quotations.imported;
      stats.quotationsUpdated += quotations.updated;
    }
  }

  return stats;
}
