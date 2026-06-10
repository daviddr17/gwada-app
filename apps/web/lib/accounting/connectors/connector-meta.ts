import type { AccountingSource } from "@/lib/types/accounting";

/** Bekannte Buchhaltungs-Connectors — erweiterbar (z. B. xero, quickbooks). */
export type AccountingConnectorKey = "none" | "lexoffice";

export type AccountingConnectorCapabilities = {
  canCreateSales: boolean;
  canCreateVouchers: boolean;
  canCreateSalesCorrections: boolean;
  canCreateVoucherCorrections: boolean;
  canSyncSales: boolean;
  canSyncVouchers: boolean;
  canFetchExternalSalesPdf: boolean;
  canFetchExternalSalesXml: boolean;
  canFetchExternalVoucherFile: boolean;
  canEnrichSalesDetail: boolean;
  canEnrichVoucherDetail: boolean;
  /** Importierte Dokumente nicht in Gwada bearbeiten. */
  readOnlyDocumentsInGwada: boolean;
};

export type AccountingConnectorPublicInfo = {
  key: AccountingConnectorKey;
  connected: boolean;
  displayName: string;
  source: AccountingSource | null;
  capabilities: AccountingConnectorCapabilities;
  autoSyncEnabled: boolean;
};

export const NONE_CONNECTOR_CAPABILITIES: AccountingConnectorCapabilities = {
  canCreateSales: true,
  canCreateVouchers: true,
  canCreateSalesCorrections: false,
  canCreateVoucherCorrections: false,
  canSyncSales: false,
  canSyncVouchers: false,
  canFetchExternalSalesPdf: false,
  canFetchExternalSalesXml: false,
  canFetchExternalVoucherFile: false,
  canEnrichSalesDetail: false,
  canEnrichVoucherDetail: false,
  readOnlyDocumentsInGwada: false,
};

export const LEXOFFICE_CONNECTOR_CAPABILITIES: AccountingConnectorCapabilities = {
  canCreateSales: true,
  canCreateVouchers: true,
  canCreateSalesCorrections: true,
  canCreateVoucherCorrections: true,
  canSyncSales: true,
  canSyncVouchers: true,
  canFetchExternalSalesPdf: true,
  canFetchExternalSalesXml: true,
  canFetchExternalVoucherFile: true,
  canEnrichSalesDetail: true,
  canEnrichVoucherDetail: true,
  readOnlyDocumentsInGwada: true,
};

export const ACCOUNTING_CONNECTOR_DISPLAY_NAMES: Record<
  AccountingConnectorKey,
  string
> = {
  none: "Gwada",
  lexoffice: "Lexware",
};

export const ACCOUNTING_CONNECTOR_SOURCES: Record<
  AccountingConnectorKey,
  AccountingSource | null
> = {
  none: "gwada",
  lexoffice: "lexoffice",
};

export function accountingConnectorCapabilities(
  key: AccountingConnectorKey,
): AccountingConnectorCapabilities {
  return key === "lexoffice"
    ? LEXOFFICE_CONNECTOR_CAPABILITIES
    : NONE_CONNECTOR_CAPABILITIES;
}
