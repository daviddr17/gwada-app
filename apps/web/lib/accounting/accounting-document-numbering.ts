import type { AccountingSettingsRow } from "@/lib/types/accounting-settings";

export type AccountingDocumentKind = "invoice" | "quotation" | "invoice_correction";

export type AccountingDocumentNumberingSettings = {
  invoiceNumberPrefix: string;
  quotationNumberPrefix: string;
  invoiceCorrectionNumberPrefix: string;
  invoiceNumberIncludeYear: boolean;
  quotationNumberIncludeYear: boolean;
  invoiceNumberMinDigits: number;
  quotationNumberMinDigits: number;
};

export const DEFAULT_INVOICE_NUMBER_PREFIX = "RE";
export const DEFAULT_QUOTATION_NUMBER_PREFIX = "AN";
export const DEFAULT_INVOICE_CORRECTION_NUMBER_PREFIX = "KO";

export function numberingSettingsFromRow(
  row: AccountingSettingsRow,
): AccountingDocumentNumberingSettings {
  return {
    invoiceNumberPrefix: row.invoice_number_prefix,
    quotationNumberPrefix: row.quotation_number_prefix,
    invoiceCorrectionNumberPrefix: row.invoice_correction_number_prefix,
    invoiceNumberIncludeYear: row.invoice_number_include_year,
    quotationNumberIncludeYear: row.quotation_number_include_year,
    invoiceNumberMinDigits: row.invoice_number_min_digits,
    quotationNumberMinDigits: row.quotation_number_min_digits,
  };
}

function sanitizePrefix(prefix: string, fallback: string): string {
  const trimmed = prefix.trim().replace(/-+$/, "");
  return trimmed || fallback;
}

export function formatAccountingDocumentNumber(
  settings: AccountingDocumentNumberingSettings,
  kind: AccountingDocumentKind,
  sequence: number,
  referenceDate?: string | null,
): string {
  const prefix =
    kind === "invoice"
      ? sanitizePrefix(
          settings.invoiceNumberPrefix,
          DEFAULT_INVOICE_NUMBER_PREFIX,
        )
      : kind === "invoice_correction"
        ? sanitizePrefix(
            settings.invoiceCorrectionNumberPrefix,
            DEFAULT_INVOICE_CORRECTION_NUMBER_PREFIX,
          )
        : sanitizePrefix(
            settings.quotationNumberPrefix,
            DEFAULT_QUOTATION_NUMBER_PREFIX,
          );
  const includeYear =
    kind === "invoice" || kind === "invoice_correction"
      ? settings.invoiceNumberIncludeYear
      : settings.quotationNumberIncludeYear;
  const minDigits =
    kind === "invoice" || kind === "invoice_correction"
      ? settings.invoiceNumberMinDigits
      : settings.quotationNumberMinDigits;
  const seqStr = String(Math.max(1, sequence)).padStart(
    Math.min(10, Math.max(1, minDigits)),
    "0",
  );

  if (includeYear) {
    const year =
      referenceDate?.slice(0, 4) ?? String(new Date().getFullYear());
    return `${prefix}-${year}-${seqStr}`;
  }
  return `${prefix}-${seqStr}`;
}

export function exampleAccountingDocumentNumber(
  settings: AccountingDocumentNumberingSettings,
  kind: AccountingDocumentKind,
): string {
  return formatAccountingDocumentNumber(settings, kind, 1);
}
