import type {
  AccountingConnectorCapabilities,
  AccountingConnectorKey,
} from "@/lib/accounting/connectors/connector-meta";
import type {
  AccountingSalesDocumentInput,
  AccountingSource,
  AccountingVoucherInput,
  AccountingVoucherItem,
} from "@/lib/types/accounting";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { AccountingConnectorKey, AccountingConnectorCapabilities };

export type ConnectorCreateSalesResult = {
  source: AccountingSource;
  externalId: string | null;
  externalVersion: number | null;
  externalEditUrl: string | null;
  externalDocumentType: string | null;
  voucherNumber: string | null;
  status: string;
};

export type ConnectorVoucherCreateResult = {
  externalId: string;
  externalVersion: number | null;
  externalEditUrl: string;
  voucherNumber: string | null;
  status: string;
  lexofficeVoucherType: string;
};

export type ConnectorSyncResult = {
  imported: number;
  updated: number;
  listed?: number;
  skipped?: boolean;
  error?: string | null;
};

export type ConnectorFileResult =
  | { ok: true; buffer: Buffer; contentType: string; filename: string }
  | { ok: false; error: string };

export type ConnectorSalesDocumentRow = {
  id: string;
  source: AccountingSource;
  external_id: string | null;
  external_document_type?: string | null;
  document_variant?: string | null;
  line_items: import("@/lib/types/accounting").AccountingLineItem[];
  totals: import("@/lib/types/accounting").AccountingTotals | null;
  updated_by: string | null;
  voucher_number?: string | null;
};

export type ConnectorVoucherRow = {
  id: string;
  source: AccountingSource;
  external_id: string | null;
  file_name?: string | null;
};

export interface AccountingConnector {
  readonly key: AccountingConnectorKey;
  readonly displayName: string;
  readonly source: AccountingSource | null;
  readonly capabilities: AccountingConnectorCapabilities;

  isConfigured(restaurantId: string): Promise<boolean>;

  createInvoice(
    restaurantId: string,
    input: AccountingSalesDocumentInput,
  ): Promise<ConnectorCreateSalesResult>;

  createQuotation(
    restaurantId: string,
    input: AccountingSalesDocumentInput,
  ): Promise<ConnectorCreateSalesResult>;

  createInvoiceCorrection(
    restaurantId: string,
    input: AccountingSalesDocumentInput,
    opts: {
      precedingExternalId?: string | null;
    },
  ): Promise<ConnectorCreateSalesResult>;

  createBookkeepingVoucher(
    restaurantId: string,
    input: AccountingVoucherInput,
    items: AccountingVoucherItem[],
    totals: { totalGross: number; totalTax: number },
  ): Promise<ConnectorVoucherCreateResult>;

  createBookkeepingCorrection(
    restaurantId: string,
    input: AccountingVoucherInput,
    items: AccountingVoucherItem[],
    totals: { totalGross: number; totalTax: number },
    opts: {
      originalLexofficeType?: string | null;
    },
  ): Promise<ConnectorVoucherCreateResult>;

  syncSalesDocuments(
    sb: SupabaseClient,
    params: {
      restaurantId: string;
      userId: string;
      kind: "invoice" | "quotation";
      force?: boolean;
    },
  ): Promise<ConnectorSyncResult>;

  syncVouchers(
    sb: SupabaseClient,
    params: {
      restaurantId: string;
      userId: string;
      force?: boolean;
    },
  ): Promise<ConnectorSyncResult>;

  enrichSalesDocument<T extends ConnectorSalesDocumentRow>(
    sb: SupabaseClient,
    params: {
      restaurantId: string;
      kind: "invoice" | "quotation";
      row: T;
      userId?: string;
      force?: boolean;
    },
  ): Promise<T>;

  enrichVoucher<T extends ConnectorVoucherRow>(
    sb: SupabaseClient,
    params: {
      restaurantId: string;
      row: T;
      userId?: string;
      force?: boolean;
    },
  ): Promise<T>;

  fetchSalesDocumentFile(
    restaurantId: string,
    params: {
      kind: "invoice" | "quotation";
      row: ConnectorSalesDocumentRow;
      format: "pdf" | "xml";
    },
  ): Promise<ConnectorFileResult | null>;

  fetchVoucherFile(
    restaurantId: string,
    row: ConnectorVoucherRow,
  ): Promise<ConnectorFileResult | null>;
}
