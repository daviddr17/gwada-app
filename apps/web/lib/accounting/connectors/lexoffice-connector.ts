import "server-only";

import {
  createLexofficeCreditNote,
  createLexofficeInvoice,
  createLexofficeQuotation,
  fetchLexofficeCreditNoteFile,
} from "@/lib/integrations/lexoffice-sales-documents";
import {
  createLexofficeBookkeepingVoucher,
  fetchLexofficeBookkeepingVoucherFile,
  mapGwadaKindToLexofficeCreditType,
  mapGwadaKindToLexofficeType,
} from "@/lib/integrations/lexoffice-bookkeeping-vouchers";
import {
  enrichLexofficeSalesDocumentRow,
  syncLexofficeSalesDocuments,
} from "@/lib/accounting/accounting-lexoffice-sync-server";
import {
  enrichLexofficeVoucherRow,
  syncLexofficeBookkeepingVouchers,
} from "@/lib/accounting/accounting-lexoffice-voucher-sync-server";
import { isAccountingCorrectionVariant } from "@/lib/accounting/accounting-corrections";
import {
  ACCOUNTING_CONNECTOR_DISPLAY_NAMES,
  ACCOUNTING_CONNECTOR_SOURCES,
  LEXOFFICE_CONNECTOR_CAPABILITIES,
  NONE_CONNECTOR_CAPABILITIES,
} from "@/lib/accounting/connectors/connector-meta";
import { fetchLexofficeSalesDocumentFile } from "@/lib/integrations/lexoffice-voucherlist";
import { fetchRestaurantLexofficeApiKey } from "@/lib/supabase/restaurant-lexoffice-integration-db";
import type {
  AccountingConnector,
  ConnectorCreateSalesResult,
  ConnectorFileResult,
  ConnectorVoucherCreateResult,
} from "@/lib/accounting/connectors/types";
import type {
  AccountingSalesDocumentInput,
  AccountingVoucherInput,
  AccountingVoucherItem,
} from "@/lib/types/accounting";

export const lexofficeAccountingConnector: AccountingConnector = {
  key: "lexoffice",
  displayName: ACCOUNTING_CONNECTOR_DISPLAY_NAMES.lexoffice,
  source: ACCOUNTING_CONNECTOR_SOURCES.lexoffice,
  capabilities: LEXOFFICE_CONNECTOR_CAPABILITIES,

  async isConfigured(restaurantId: string): Promise<boolean> {
    const key = await fetchRestaurantLexofficeApiKey(restaurantId);
    return Boolean(key);
  },

  async createInvoice(
    restaurantId: string,
    input: AccountingSalesDocumentInput,
  ): Promise<ConnectorCreateSalesResult> {
    const created = await createLexofficeInvoice(restaurantId, input);
    return {
      source: "lexoffice",
      externalId: created.id,
      externalVersion: created.version,
      externalEditUrl: created.editUrl,
      externalDocumentType: "invoice",
      voucherNumber: created.voucherNumber,
      status: created.voucherStatus,
    };
  },

  async createQuotation(
    restaurantId: string,
    input: AccountingSalesDocumentInput,
  ): Promise<ConnectorCreateSalesResult> {
    const created = await createLexofficeQuotation(restaurantId, input);
    return {
      source: "lexoffice",
      externalId: created.id,
      externalVersion: created.version,
      externalEditUrl: created.editUrl,
      externalDocumentType: "quotation",
      voucherNumber: created.voucherNumber,
      status: created.voucherStatus,
    };
  },

  async createInvoiceCorrection(
    restaurantId: string,
    input: AccountingSalesDocumentInput,
    opts: { precedingExternalId?: string | null },
  ): Promise<ConnectorCreateSalesResult> {
    const created = await createLexofficeCreditNote(restaurantId, input, {
      precedingExternalId: opts.precedingExternalId,
      finalize: input.finalizeOnCreate,
    });
    return {
      source: "lexoffice",
      externalId: created.id,
      externalVersion: created.version,
      externalEditUrl: created.editUrl,
      externalDocumentType: "credit_note",
      voucherNumber: created.voucherNumber,
      status: created.voucherStatus,
    };
  },

  async createBookkeepingVoucher(
    restaurantId: string,
    input: AccountingVoucherInput,
    items: AccountingVoucherItem[],
    totals: { totalGross: number; totalTax: number },
  ): Promise<ConnectorVoucherCreateResult> {
    const created = await createLexofficeBookkeepingVoucher(
      restaurantId,
      input,
      items,
      totals,
    );
    if (!created.ok) {
      throw new Error(created.error);
    }
    return {
      externalId: created.externalId,
      externalVersion: created.externalVersion,
      externalEditUrl: created.externalEditUrl,
      voucherNumber: created.voucherNumber,
      status: created.status,
      lexofficeVoucherType: created.lexofficeVoucherType,
    };
  },

  async createBookkeepingCorrection(
    restaurantId: string,
    input: AccountingVoucherInput,
    items: AccountingVoucherItem[],
    totals: { totalGross: number; totalTax: number },
    opts: { originalLexofficeType?: string | null },
  ): Promise<ConnectorVoucherCreateResult> {
    const creditType = mapGwadaKindToLexofficeCreditType(
      input.voucherKind,
      opts.originalLexofficeType,
    );
    const created = await createLexofficeBookkeepingVoucher(
      restaurantId,
      input,
      items,
      totals,
      { lexofficeType: creditType },
    );
    if (!created.ok) {
      throw new Error(created.error);
    }
    return {
      externalId: created.externalId,
      externalVersion: created.externalVersion,
      externalEditUrl: created.externalEditUrl,
      voucherNumber: created.voucherNumber,
      status: created.status,
      lexofficeVoucherType: created.lexofficeVoucherType,
    };
  },

  async syncSalesDocuments(sb, params) {
    const result = await syncLexofficeSalesDocuments(sb, params);
    return { ...result, error: result.error ?? undefined };
  },

  async syncVouchers(sb, params) {
    const result = await syncLexofficeBookkeepingVouchers(sb, params);
    return { ...result, error: result.error ?? undefined };
  },

  async enrichSalesDocument(sb, params) {
    return enrichLexofficeSalesDocumentRow(sb, {
      ...params,
      row: {
        ...params.row,
        external_document_type: params.row.external_document_type ?? null,
      },
    }) as Promise<typeof params.row>;
  },

  async enrichVoucher(sb, params) {
    const enriched = await enrichLexofficeVoucherRow(sb, {
      ...params,
      row: params.row as unknown as import("@/lib/types/accounting").AccountingVoucherRow,
    });
    return enriched as unknown as typeof params.row;
  },

  async fetchSalesDocumentFile(restaurantId, params) {
    const { kind, row, format } = params;
    if (row.source !== "lexoffice" || !row.external_id) {
      return null;
    }

    const isCorrection =
      isAccountingCorrectionVariant(row.document_variant) ||
      row.external_document_type === "credit_note";

    if (isCorrection && kind === "invoice" && format === "pdf") {
      const file = await fetchLexofficeCreditNoteFile(
        restaurantId,
        row.external_id,
        "pdf",
      );
      return file.ok ? file : { ok: false, error: file.error };
    }

    const file = await fetchLexofficeSalesDocumentFile(
      restaurantId,
      kind,
      row.external_id,
      format,
    );
    return file.ok ? file : { ok: false, error: file.error };
  },

  async fetchVoucherFile(restaurantId, row) {
    if (row.source !== "lexoffice" || !row.external_id) {
      return null;
    }
    const knownFileId =
      row.file_name?.trim() && row.file_name !== "" ? row.file_name : null;
    const file = await fetchLexofficeBookkeepingVoucherFile(
      restaurantId,
      row.external_id,
      knownFileId,
    );
    return file.ok ? file : { ok: false, error: file.error };
  },
};

/** Gwada-only: kein externer Connector — Spiegel bleibt rein lokal. */
export const noneAccountingConnector: AccountingConnector = {
  key: "none",
  displayName: ACCOUNTING_CONNECTOR_DISPLAY_NAMES.none,
  source: ACCOUNTING_CONNECTOR_SOURCES.none,
  capabilities: NONE_CONNECTOR_CAPABILITIES,

  async isConfigured() {
    return false;
  },

  async createInvoice(_restaurantId, input) {
    const status = input.finalizeOnCreate ? "open" : (input.status ?? "draft");
    return {
      source: "gwada",
      externalId: null,
      externalVersion: null,
      externalEditUrl: null,
      externalDocumentType: null,
      voucherNumber: null,
      status,
    };
  },

  async createQuotation(_restaurantId, input) {
    return this.createInvoice(_restaurantId, input);
  },

  async createInvoiceCorrection(_restaurantId, input) {
    return this.createInvoice(_restaurantId, input);
  },

  async createBookkeepingVoucher() {
    throw new Error("Externer Connector nicht konfiguriert.");
  },

  async createBookkeepingCorrection() {
    throw new Error("Externer Connector nicht konfiguriert.");
  },

  async syncSalesDocuments() {
    return {
      imported: 0,
      updated: 0,
      skipped: true,
      error: "Kein externer Connector konfiguriert.",
    };
  },

  async syncVouchers() {
    return {
      imported: 0,
      updated: 0,
      skipped: true,
      error: "Kein externer Connector konfiguriert.",
    };
  },

  async enrichSalesDocument(_sb, params) {
    return params.row;
  },

  async enrichVoucher(_sb, params) {
    return params.row;
  },

  async fetchSalesDocumentFile() {
    return null;
  },

  async fetchVoucherFile() {
    return null;
  },
};

export function mapGwadaKindToLexofficeTypeExport(
  kind: Parameters<typeof mapGwadaKindToLexofficeType>[0],
) {
  return mapGwadaKindToLexofficeType(kind);
}
