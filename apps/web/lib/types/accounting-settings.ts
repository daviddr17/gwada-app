export type AccountingDocumentFormat = "pdf" | "zugferd_pdf";

export type AccountingDocumentFontFamily = "helvetica" | "times" | "courier";

export type AccountingLogoPosition = "left" | "right";

export type AccountingLayoutZone = "header" | "meta" | "footer";

export type AccountingLayoutBlockType =
  | "logo"
  | "company_name"
  | "company_street"
  | "company_city"
  | "company_country"
  | "company_phone"
  | "company_website"
  | "company_vat"
  | "company_receipt_footer"
  | "custom_text"
  | "document_title"
  | "voucher_number"
  | "voucher_date"
  | "recipient";

export type AccountingLayoutBlock = {
  id: string;
  zone: AccountingLayoutZone;
  type: AccountingLayoutBlockType;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  align: "left" | "center" | "right";
  customText?: string | null;
};

export type AccountingDocumentDesign = {
  fontFamily: AccountingDocumentFontFamily;
  layoutBlocks: AccountingLayoutBlock[];
};

import type { AccountingConnectorSettingsMap } from "@/lib/accounting/accounting-connector-settings";

export type AccountingSettingsRow = {
  restaurant_id: string;
  document_format: AccountingDocumentFormat;
  connector_settings: AccountingConnectorSettingsMap;
  /** Abgeleitet aus connector_settings.lexoffice — API-Kompatibilität. */
  auto_sync_lexoffice: boolean;
  deduct_inventory_on_invoice: boolean;
  reverse_inventory_on_invoice_correction: boolean;
  document_design: AccountingDocumentDesign;
  invoice_number_prefix: string;
  quotation_number_prefix: string;
  invoice_correction_number_prefix: string;
  invoice_number_include_year: boolean;
  quotation_number_include_year: boolean;
  invoice_number_min_digits: number;
  quotation_number_min_digits: number;
  /** Abgeleitet aus connector_settings.lexoffice.lastSync */
  last_lexoffice_invoices_sync_at: string | null;
  last_lexoffice_quotations_sync_at: string | null;
  last_lexoffice_vouchers_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_ACCOUNTING_DOCUMENT_DESIGN: AccountingDocumentDesign = {
  fontFamily: "helvetica",
  layoutBlocks: [],
};

export {
  DEFAULT_INVOICE_NUMBER_PREFIX,
  DEFAULT_QUOTATION_NUMBER_PREFIX,
  exampleAccountingDocumentNumber,
  formatAccountingDocumentNumber,
  numberingSettingsFromRow,
  type AccountingDocumentNumberingSettings,
} from "@/lib/accounting/accounting-document-numbering";

export const ACCOUNTING_DOCUMENT_FONT_OPTIONS: {
  value: AccountingDocumentFontFamily;
  label: string;
}[] = [
  { value: "helvetica", label: "Helvetica (Sans)" },
  { value: "times", label: "Times (Serif)" },
  { value: "courier", label: "Courier (Mono)" },
];

export const ACCOUNTING_LOGO_POSITION_OPTIONS: {
  value: AccountingLogoPosition;
  label: string;
}[] = [
  { value: "left", label: "Logo links" },
  { value: "right", label: "Logo rechts" },
];

export const ACCOUNTING_DOCUMENT_FORMAT_OPTIONS: {
  value: AccountingDocumentFormat;
  label: string;
  description: string;
}[] = [
  {
    value: "pdf",
    label: "Nur PDF",
    description: "Standard-PDF für Vorschau und Versand.",
  },
  {
    value: "zugferd_pdf",
    label: "PDF + E-Rechnung (XML)",
    description:
      "Zusätzlich EN16931-XML (ZUGFeRD-kompatibel) — für Gwada- und Lexware-Dokumente.",
  },
];

export type AccountingSendChannel = "email" | "whatsapp";

export type AccountingSendDocumentInput = {
  sendEmail?: boolean;
  sendWhatsapp?: boolean;
  sendOnSave?: boolean;
};

export { parseAccountingDocumentDesign } from "@/lib/accounting/accounting-document-layout";
