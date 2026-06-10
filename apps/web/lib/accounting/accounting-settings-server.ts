import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeAccountingSettingsRow } from "@/lib/accounting/accounting-document-design";
import type {
  AccountingDocumentDesign,
  AccountingDocumentFormat,
  AccountingSettingsRow,
} from "@/lib/types/accounting-settings";

export async function getAccountingSettings(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<AccountingSettingsRow> {
  const { data } = await sb
    .from("restaurant_accounting_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return mergeAccountingSettingsRow(
    (data as Record<string, unknown> | null) ?? null,
    restaurantId,
  ) as AccountingSettingsRow;
}

export async function upsertAccountingSettings(
  sb: SupabaseClient,
  restaurantId: string,
  patch: {
    documentFormat?: AccountingDocumentFormat;
    autoSyncLexoffice?: boolean;
    deductInventoryOnInvoice?: boolean;
    documentDesign?: AccountingDocumentDesign;
  },
): Promise<{ row: AccountingSettingsRow | null; error: string | null }> {
  const payload: Record<string, unknown> = {
    restaurant_id: restaurantId,
  };
  if (patch.documentFormat !== undefined) {
    payload.document_format = patch.documentFormat;
  }
  if (patch.autoSyncLexoffice !== undefined) {
    payload.auto_sync_lexoffice = patch.autoSyncLexoffice;
  }
  if (patch.deductInventoryOnInvoice !== undefined) {
    payload.deduct_inventory_on_invoice = patch.deductInventoryOnInvoice;
  }
  if (patch.documentDesign !== undefined) {
    payload.document_design = patch.documentDesign;
  }

  const { data, error } = await sb
    .from("restaurant_accounting_settings")
    .upsert(payload, { onConflict: "restaurant_id" })
    .select("*")
    .single();

  if (error) return { row: null, error: error.message };
  return {
    row: mergeAccountingSettingsRow(
      data as Record<string, unknown>,
      restaurantId,
    ) as AccountingSettingsRow,
    error: null,
  };
}

export async function touchLexofficeSyncTimestamp(
  sb: SupabaseClient,
  restaurantId: string,
  kind: "invoice" | "quotation" | "voucher",
): Promise<void> {
  const column =
    kind === "invoice"
      ? "last_lexoffice_invoices_sync_at"
      : kind === "quotation"
        ? "last_lexoffice_quotations_sync_at"
        : "last_lexoffice_vouchers_sync_at";
  await sb.from("restaurant_accounting_settings").upsert(
    {
      restaurant_id: restaurantId,
      [column]: new Date().toISOString(),
    },
    { onConflict: "restaurant_id" },
  );
}
