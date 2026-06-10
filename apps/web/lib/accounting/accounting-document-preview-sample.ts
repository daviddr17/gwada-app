import "server-only";

import type {
  AccountingInvoiceRow,
  AccountingLineItem,
  AccountingQuotationRow,
  AccountingTotals,
} from "@/lib/types/accounting";

const PREVIEW_LINE_ITEMS: AccountingLineItem[] = [
  {
    id: "preview-1",
    sortOrder: 0,
    type: "custom",
    articleId: null,
    name: "Beratung & Konzept",
    description: "Monatliche Pauschale",
    quantity: 1,
    unitName: "Pauschale",
    unitPrice: 850,
    taxRatePercent: 19,
    discountPercent: 0,
    lineAmount: 850,
  },
  {
    id: "preview-2",
    sortOrder: 1,
    type: "custom",
    articleId: null,
    name: "Catering-Service",
    description: "Buffet für 20 Personen",
    quantity: 20,
    unitName: "Portion",
    unitPrice: 12.5,
    taxRatePercent: 7,
    discountPercent: 0,
    lineAmount: 250,
  },
];

const PREVIEW_TOTALS: AccountingTotals = {
  currency: "EUR",
  totalNet: 1100,
  totalTax: 179,
  totalGross: 1279,
};

function previewBaseFields(restaurantId: string) {
  const now = new Date().toISOString();
  const voucherDate = new Date().toISOString().slice(0, 10);

  return {
    id: "00000000-0000-4000-8000-000000000001",
    restaurant_id: restaurantId,
    source: "gwada" as const,
    external_id: null,
    external_version: null,
    external_edit_url: null,
    voucher_number: "M-2026-0042",
    voucher_date: voucherDate,
    voucher_date_kind: "date" as const,
    voucher_period_start: null,
    voucher_period_end: null,
    delivery_date: voucherDate,
    currency: "EUR",
    tax_mode: "net" as const,
    recipient_type: "contact" as const,
    contact_id: null,
    recipient_snapshot: {
      name: "Musterfirma GmbH",
      supplement: "z. Hd. Beata Kreft",
      street: "Musterstraße 12",
      city: "Berlin",
      zip: "10115",
      countryCode: "DE",
      email: "rechnung@musterfirma.de",
      phone: "+49 30 12345678",
    },
    line_items: PREVIEW_LINE_ITEMS,
    totals: PREVIEW_TOTALS,
    title: null,
    introduction: "Vielen Dank für Ihren Auftrag. Wir erlauben uns, folgende Leistungen in Rechnung zu stellen.",
    remark: "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
    finalize_on_create: false,
    sent_at: null,
    sent_channels: [] as string[],
    created_by: null,
    updated_by: null,
    created_at: now,
    updated_at: now,
  };
}

export function buildAccountingPreviewInvoiceRow(
  restaurantId: string,
): AccountingInvoiceRow {
  return {
    ...previewBaseFields(restaurantId),
    status: "open",
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  };
}

export function buildAccountingPreviewQuotationRow(
  restaurantId: string,
): AccountingQuotationRow {
  const base = previewBaseFields(restaurantId);
  return {
    ...base,
    voucher_number: "A-2026-0018",
    status: "open",
    expiration_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    introduction:
      "Gerne unterbreiten wir Ihnen folgendes Angebot. Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.",
    remark: "Angebot gültig bis zum angegebenen Datum.",
  };
}
