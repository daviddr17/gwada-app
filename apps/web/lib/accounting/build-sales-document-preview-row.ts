import "server-only";

import {
  buildVoucherPeriodIntroduction,
  resolveStoredVoucherDate,
} from "@/lib/accounting/accounting-voucher-date";
import { computeDocumentTotals } from "@/lib/accounting/compute-line-totals";
import type {
  AccountingInvoiceRow,
  AccountingLineItem,
  AccountingQuotationRow,
  AccountingRecipientSnapshot,
  AccountingTaxMode,
  AccountingVoucherDateKind,
} from "@/lib/types/accounting";

export type AccountingSalesDocumentDraftPreviewInput = {
  voucherNumber?: string | null;
  recipient: AccountingRecipientSnapshot;
  voucherDate: string;
  voucherDateKind?: AccountingVoucherDateKind;
  voucherPeriodStart?: string | null;
  voucherPeriodEnd?: string | null;
  dueDate?: string | null;
  deliveryDate?: string | null;
  expirationDate?: string | null;
  currency: string;
  taxMode: AccountingTaxMode;
  lineItems: AccountingLineItem[];
  title?: string | null;
  introduction?: string | null;
  remark?: string | null;
  status?: string;
};

function previewBaseRow(
  restaurantId: string,
  draft: AccountingSalesDocumentDraftPreviewInput,
) {
  const now = new Date().toISOString();
  const lineItems = draft.lineItems.length
    ? draft.lineItems
    : [
        {
          id: "preview-empty",
          sortOrder: 0,
          type: "custom" as const,
          articleId: null,
          name: "Position",
          description: null,
          quantity: 1,
          unitName: "Stück",
          unitPrice: 0,
          taxRatePercent: 0,
          discountPercent: 0,
          lineAmount: 0,
        },
      ];
  const totals = computeDocumentTotals(
    lineItems,
    draft.taxMode,
    draft.currency,
  );
  const voucherDateKind = draft.voucherDateKind ?? "date";

  return {
    id: "00000000-0000-4000-8000-000000000002",
    restaurant_id: restaurantId,
    source: "gwada" as const,
    external_id: null,
    external_version: null,
    external_edit_url: null,
    external_document_type: null,
    external_updated_at: null,
    document_variant: "standard" as const,
    corrects_id: null,
    voucher_number: draft.voucherNumber?.trim() || "—",
    voucher_date: resolveStoredVoucherDate({
      voucherDateKind,
      voucherDate: draft.voucherDate,
      voucherPeriodEnd: draft.voucherPeriodEnd ?? null,
    }),
    voucher_date_kind: voucherDateKind,
    voucher_period_start:
      voucherDateKind === "period" ? (draft.voucherPeriodStart ?? null) : null,
    voucher_period_end:
      voucherDateKind === "period" ? (draft.voucherPeriodEnd ?? null) : null,
    delivery_date: draft.deliveryDate ?? null,
    currency: draft.currency,
    tax_mode: draft.taxMode,
    recipient_type: "contact" as const,
    contact_id: null,
    recipient_snapshot: draft.recipient,
    line_items: lineItems,
    totals,
    title: draft.title ?? null,
    introduction:
      buildVoucherPeriodIntroduction({
        voucherDateKind,
        voucherPeriodStart: draft.voucherPeriodStart ?? null,
        voucherPeriodEnd: draft.voucherPeriodEnd ?? null,
        introduction: draft.introduction,
      }) ??
      draft.introduction ??
      null,
    remark: draft.remark ?? null,
    finalize_on_create: false,
    sent_at: null,
    sent_channels: [] as string[],
    created_by: null,
    updated_by: null,
    created_at: now,
    updated_at: now,
    status: draft.status ?? "draft",
  };
}

export function buildSalesDocumentPreviewInvoiceRow(
  restaurantId: string,
  draft: AccountingSalesDocumentDraftPreviewInput,
): AccountingInvoiceRow {
  return {
    ...previewBaseRow(restaurantId, draft),
    due_date: draft.dueDate ?? null,
  };
}

export function buildSalesDocumentPreviewQuotationRow(
  restaurantId: string,
  draft: AccountingSalesDocumentDraftPreviewInput,
): AccountingQuotationRow {
  return {
    ...previewBaseRow(restaurantId, draft),
    expiration_date: draft.expirationDate ?? draft.dueDate ?? null,
  };
}
