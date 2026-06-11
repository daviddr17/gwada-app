import { randomUUID } from "crypto";
import type { AccountingLineItem, AccountingTotals } from "@/lib/types/accounting";
import {
  mapLexofficeTaxMode,
  mapLexofficeVoucherStatus,
  type LexofficeSalesDetail,
  type LexofficeVoucherListItem,
} from "@/lib/integrations/lexoffice-voucherlist";

function parseVoucherDate(isoOrDate: string | undefined): string {
  if (!isoOrDate) return new Date().toISOString().slice(0, 10);
  return isoOrDate.slice(0, 10);
}

function optionalVoucherDate(isoOrDate: string | null | undefined): string | null {
  if (!isoOrDate) return null;
  return isoOrDate.slice(0, 10);
}

export function coerceLexofficeExternalVersion(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return parseInt(value.trim(), 10);
  }
  return null;
}

function unitPriceFromLexofficeLine(
  unitPrice: Record<string, unknown> | undefined,
  taxMode: string,
): number {
  if (!unitPrice) return 0;
  if (taxMode === "gross") {
    return Number(unitPrice.grossAmount ?? unitPrice.netAmount ?? 0);
  }
  return Number(unitPrice.netAmount ?? unitPrice.grossAmount ?? 0);
}

export function lineItemsFromLexofficeSalesDetail(
  detail: LexofficeSalesDetail,
  taxMode: string,
): AccountingLineItem[] {
  return (detail.lineItems ?? []).map((raw, index) => {
    const lexType = String(raw.type ?? "custom").toLowerCase();
    if (lexType === "text") {
      return {
        id: randomUUID(),
        sortOrder: index,
        type: "text",
        articleId: null,
        name: String(raw.name ?? ""),
        description: raw.description ? String(raw.description) : null,
        quantity: 0,
        unitName: "",
        unitPrice: 0,
        taxRatePercent: 0,
        discountPercent: 0,
        lineAmount: 0,
      };
    }

    const unitPriceObj = raw.unitPrice as Record<string, unknown> | undefined;
    const quantity = Number(raw.quantity ?? 1);
    const discountPercent = Number(raw.discountPercentage ?? 0);
    const unitPrice = unitPriceFromLexofficeLine(unitPriceObj, taxMode);
    const taxRatePercent = Number(unitPriceObj?.taxRatePercentage ?? 0);
    const explicitAmount =
      raw.lineItemAmount != null ? Number(raw.lineItemAmount) : null;
    const lineAmount =
      explicitAmount ??
      quantity * unitPrice * (1 - discountPercent / 100);

    return {
      id: randomUUID(),
      sortOrder: index,
      type: "custom",
      articleId: null,
      name: String(raw.name ?? "Position"),
      description: raw.description ? String(raw.description) : null,
      quantity,
      unitName: String(raw.unitName ?? "Stück"),
      unitPrice,
      taxRatePercent,
      discountPercent,
      lineAmount,
    };
  });
}

export function totalsFromLexofficeSalesDetail(
  detail: LexofficeSalesDetail,
  fallbackCurrency: string,
): AccountingTotals {
  const tp = detail.totalPrice;
  const currency = tp?.currency ?? fallbackCurrency;
  return {
    currency,
    totalNet: Number(tp?.totalNetAmount ?? 0),
    totalTax: Number(tp?.totalTaxAmount ?? 0),
    totalGross: Number(tp?.totalGrossAmount ?? 0),
  };
}

export function salesDocumentPatchFromLexofficeDetail(
  kind: "invoice" | "quotation",
  detail: LexofficeSalesDetail,
  listItem?: LexofficeVoucherListItem,
): Record<string, unknown> {
  const taxMode = mapLexofficeTaxMode(detail.taxConditions?.taxType);
  const currency =
    detail.totalPrice?.currency ?? listItem?.currency ?? "EUR";
  const addr = detail.address;
  const lineItems = lineItemsFromLexofficeSalesDetail(detail, taxMode);

  const patch: Record<string, unknown> = {
    external_version: coerceLexofficeExternalVersion(detail.version),
    status: mapLexofficeVoucherStatus(
      detail.voucherStatus ?? listItem?.voucherStatus,
      kind,
    ),
    voucher_number: detail.voucherNumber ?? listItem?.voucherNumber ?? null,
    voucher_date: parseVoucherDate(detail.voucherDate ?? listItem?.voucherDate),
    tax_mode: taxMode,
    currency,
    recipient_type: "one_time",
    contact_id: null,
    recipient_snapshot: {
      name:
        addr?.name?.trim() ||
        listItem?.contactName?.trim() ||
        "Unbenannt",
      supplement: addr?.supplement ?? null,
      street: addr?.street ?? null,
      city: addr?.city ?? null,
      zip: addr?.zip ?? null,
      countryCode: addr?.countryCode ?? "DE",
    },
    line_items: lineItems,
    totals: totalsFromLexofficeSalesDetail(detail, currency),
    title: detail.title ?? null,
    introduction: detail.introduction ?? null,
    remark: detail.remark ?? null,
  };

  if (kind === "invoice") {
    patch.due_date = optionalVoucherDate(detail.dueDate ?? listItem?.dueDate);
  } else {
    patch.expiration_date = optionalVoucherDate(detail.expirationDate);
  }

  return patch;
}

export function listTotalsFallbackFromListItem(
  item: LexofficeVoucherListItem,
): AccountingTotals {
  const currency = item.currency ?? "EUR";
  const gross = Number(item.totalAmount ?? 0);
  return {
    currency,
    totalNet: gross,
    totalTax: 0,
    totalGross: gross,
  };
}
