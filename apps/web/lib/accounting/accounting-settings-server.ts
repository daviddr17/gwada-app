import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeAccountingSettingsRow } from "@/lib/accounting/accounting-document-design";
import {
  connectorLastSyncAt,
  setConnectorAutoSync,
  setConnectorLastSync,
  setLexofficeConnectorFeatures,
  type AccountingConnectorSyncScope,
  type LexofficeConnectorFeatureFlags,
} from "@/lib/accounting/accounting-connector-settings";
import type { AccountingConnectorKey } from "@/lib/accounting/connectors/connector-meta";
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

function legacyLexofficeSyncColumn(
  scope: AccountingConnectorSyncScope,
): string {
  switch (scope) {
    case "invoices":
      return "last_lexoffice_invoices_sync_at";
    case "quotations":
      return "last_lexoffice_quotations_sync_at";
    case "vouchers":
      return "last_lexoffice_vouchers_sync_at";
  }
}

export async function upsertAccountingSettings(
  sb: SupabaseClient,
  restaurantId: string,
  patch: {
    documentFormat?: AccountingDocumentFormat;
    autoSyncLexoffice?: boolean;
    connectorAutoSync?: {
      connector: AccountingConnectorKey;
      enabled: boolean;
    };
    deductInventoryOnInvoice?: boolean;
    reverseInventoryOnInvoiceCorrection?: boolean;
    documentDesign?: AccountingDocumentDesign;
    invoiceNumberPrefix?: string;
    invoiceCorrectionNumberPrefix?: string;
    quotationNumberPrefix?: string;
    invoiceNumberIncludeYear?: boolean;
    quotationNumberIncludeYear?: boolean;
    invoiceNumberMinDigits?: number;
    quotationNumberMinDigits?: number;
    lexofficeFeatures?: Partial<LexofficeConnectorFeatureFlags>;
  },
): Promise<{ row: AccountingSettingsRow | null; error: string | null }> {
  const payload: Record<string, unknown> = {
    restaurant_id: restaurantId,
  };

  const connectorPatch =
    patch.connectorAutoSync ??
    (patch.autoSyncLexoffice !== undefined
      ? { connector: "lexoffice" as const, enabled: patch.autoSyncLexoffice }
      : undefined);

  if (connectorPatch && connectorPatch.connector !== "none") {
    const current = await getAccountingSettings(sb, restaurantId);
    payload.connector_settings = setConnectorAutoSync(
      current.connector_settings,
      connectorPatch.connector,
      connectorPatch.enabled,
    );
    if (connectorPatch.connector === "lexoffice") {
      payload.auto_sync_lexoffice = connectorPatch.enabled;
    }
  }

  if (patch.documentFormat !== undefined) {
    payload.document_format = patch.documentFormat;
  }
  if (patch.deductInventoryOnInvoice !== undefined) {
    payload.deduct_inventory_on_invoice = patch.deductInventoryOnInvoice;
  }
  if (patch.reverseInventoryOnInvoiceCorrection !== undefined) {
    payload.reverse_inventory_on_invoice_correction =
      patch.reverseInventoryOnInvoiceCorrection;
  }
  if (patch.documentDesign !== undefined) {
    payload.document_design = patch.documentDesign;
  }
  if (patch.invoiceNumberPrefix !== undefined) {
    payload.invoice_number_prefix = patch.invoiceNumberPrefix.trim() || "RE";
  }
  if (patch.invoiceCorrectionNumberPrefix !== undefined) {
    payload.invoice_correction_number_prefix =
      patch.invoiceCorrectionNumberPrefix.trim() || "KO";
  }
  if (patch.quotationNumberPrefix !== undefined) {
    payload.quotation_number_prefix = patch.quotationNumberPrefix.trim() || "AN";
  }
  if (patch.invoiceNumberIncludeYear !== undefined) {
    payload.invoice_number_include_year = patch.invoiceNumberIncludeYear;
  }
  if (patch.quotationNumberIncludeYear !== undefined) {
    payload.quotation_number_include_year = patch.quotationNumberIncludeYear;
  }
  if (patch.invoiceNumberMinDigits !== undefined) {
    payload.invoice_number_min_digits = Math.min(
      10,
      Math.max(1, patch.invoiceNumberMinDigits),
    );
  }
  if (patch.quotationNumberMinDigits !== undefined) {
    payload.quotation_number_min_digits = Math.min(
      10,
      Math.max(1, patch.quotationNumberMinDigits),
    );
  }

  if (patch.lexofficeFeatures && Object.keys(patch.lexofficeFeatures).length > 0) {
    const current = await getAccountingSettings(sb, restaurantId);
    payload.connector_settings = setLexofficeConnectorFeatures(
      current.connector_settings,
      patch.lexofficeFeatures,
    );
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

export async function touchConnectorSyncTimestamp(
  sb: SupabaseClient,
  restaurantId: string,
  connectorKey: AccountingConnectorKey,
  scope: AccountingConnectorSyncScope,
): Promise<void> {
  if (connectorKey === "none") return;

  const settings = await getAccountingSettings(sb, restaurantId);
  const iso = new Date().toISOString();
  const connector_settings = setConnectorLastSync(
    settings.connector_settings,
    connectorKey,
    scope,
    iso,
  );

  const payload: Record<string, unknown> = {
    restaurant_id: restaurantId,
    connector_settings,
  };

  if (connectorKey === "lexoffice") {
    payload[legacyLexofficeSyncColumn(scope)] = iso;
  }

  await sb
    .from("restaurant_accounting_settings")
    .upsert(payload, { onConflict: "restaurant_id" });
}

/** @deprecated touchConnectorSyncTimestamp */
export async function touchLexofficeSyncTimestamp(
  sb: SupabaseClient,
  restaurantId: string,
  kind: "invoice" | "quotation" | "voucher",
): Promise<void> {
  const scope =
    kind === "invoice"
      ? "invoices"
      : kind === "quotation"
        ? "quotations"
        : "vouchers";
  await touchConnectorSyncTimestamp(sb, restaurantId, "lexoffice", scope);
}

export function connectorSyncCooldownLastAt(
  settings: AccountingSettingsRow,
  connectorKey: AccountingConnectorKey,
  scope: AccountingConnectorSyncScope,
): string | null {
  return connectorLastSyncAt(settings.connector_settings, connectorKey, scope);
}
