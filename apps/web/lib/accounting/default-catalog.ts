import type { AccountingLineItem } from "@/lib/types/accounting";

export const DEFAULT_ACCOUNTING_TAX_RATES = [
  { label: "0 %", rate_percent: 0, is_default: false, sort_order: 0 },
  { label: "7 %", rate_percent: 7, is_default: false, sort_order: 1 },
  { label: "19 %", rate_percent: 19, is_default: true, sort_order: 2 },
] as const;

export const DEFAULT_ACCOUNTING_UNITS = [
  "Stück",
  "Stunde",
  "Pauschal",
  "kg",
  "l",
] as const;

export type AccountingDocumentKind = "invoice" | "quotation" | "voucher";

export type DefaultAccountingDocumentStatus = {
  code: string;
  label: string;
  sort_order: number;
  is_system: boolean;
  color_hex: string;
};

export const DEFAULT_ACCOUNTING_DOCUMENT_STATUSES: Record<
  AccountingDocumentKind,
  readonly DefaultAccountingDocumentStatus[]
> = {
  invoice: [
    { code: "open", label: "Offen", sort_order: 0, is_system: true, color_hex: "#0ea5e9" },
    { code: "paid", label: "Bezahlt", sort_order: 1, is_system: true, color_hex: "#22c55e" },
    { code: "voided", label: "Storniert", sort_order: 2, is_system: true, color_hex: "#64748b" },
    { code: "overdue", label: "Überfällig", sort_order: 3, is_system: true, color_hex: "#e11d48" },
    { code: "draft", label: "Entwurf", sort_order: 4, is_system: true, color_hex: "#94a3b8" },
    { code: "sent", label: "Verschickt", sort_order: 5, is_system: true, color_hex: "#06b6d4" },
  ],
  quotation: [
    { code: "open", label: "Offen", sort_order: 0, is_system: true, color_hex: "#0ea5e9" },
    { code: "draft", label: "Entwurf", sort_order: 1, is_system: true, color_hex: "#94a3b8" },
    { code: "sent", label: "Verschickt", sort_order: 2, is_system: true, color_hex: "#06b6d4" },
    { code: "accepted", label: "Angenommen", sort_order: 3, is_system: true, color_hex: "#22c55e" },
    { code: "rejected", label: "Abgelehnt", sort_order: 4, is_system: true, color_hex: "#f97316" },
    { code: "voided", label: "Storniert", sort_order: 5, is_system: true, color_hex: "#64748b" },
  ],
  voucher: [
    { code: "open", label: "Offen", sort_order: 0, is_system: true, color_hex: "#0ea5e9" },
    { code: "paid", label: "Bezahlt", sort_order: 1, is_system: true, color_hex: "#22c55e" },
    { code: "voided", label: "Storniert", sort_order: 2, is_system: true, color_hex: "#64748b" },
    { code: "unchecked", label: "Ungeprüft", sort_order: 3, is_system: true, color_hex: "#eab308" },
    { code: "draft", label: "Entwurf", sort_order: 4, is_system: true, color_hex: "#94a3b8" },
  ],
};

export function createEmptyLineItem(
  defaults: { unitName?: string; taxRatePercent?: number } = {},
): AccountingLineItem {
  return {
    id: crypto.randomUUID(),
    sortOrder: 0,
    type: "custom",
    articleId: null,
    name: "",
    description: null,
    quantity: 1,
    unitName: defaults.unitName ?? "Stück",
    unitPrice: 0,
    taxRatePercent: defaults.taxRatePercent ?? 0,
    discountPercent: 0,
    lineAmount: 0,
  };
}
