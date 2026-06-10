import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { touchLexofficeSyncTimestamp } from "@/lib/accounting/accounting-settings-server";
import {
  fetchAllLexofficeVoucherList,
  fetchLexofficeSalesDetail,
  lexofficeEditUrl,
  mapLexofficeTaxMode,
  mapLexofficeVoucherStatus,
  type LexofficeSalesDetail,
  type LexofficeVoucherListItem,
} from "@/lib/integrations/lexoffice-voucherlist";
import type {
  AccountingLineItem,
  AccountingRecipientSnapshot,
  AccountingTotals,
} from "@/lib/types/accounting";

function parseVoucherDate(isoOrDate: string | undefined): string {
  if (!isoOrDate) return new Date().toISOString().slice(0, 10);
  return isoOrDate.slice(0, 10);
}

function optionalVoucherDate(isoOrDate: string | null | undefined): string | null {
  if (!isoOrDate) return null;
  return isoOrDate.slice(0, 10);
}

function recipientFromLexoffice(detail: LexofficeSalesDetail): AccountingRecipientSnapshot {
  const a = detail.address;
  return {
    name: a?.name?.trim() || "Unbenannt",
    supplement: a?.supplement ?? null,
    street: a?.street ?? null,
    city: a?.city ?? null,
    zip: a?.zip ?? null,
    countryCode: a?.countryCode ?? "DE",
  };
}

function totalsFromLexoffice(detail: LexofficeSalesDetail): AccountingTotals {
  const currency = detail.totalPrice?.currency ?? "EUR";
  const totalNet = detail.totalPrice?.totalNetAmount ?? 0;
  const totalGross = detail.totalPrice?.totalGrossAmount ?? 0;
  const totalTax = detail.totalPrice?.totalTaxAmount ?? totalGross - totalNet;
  return { currency, totalNet, totalTax, totalGross };
}

function lineItemsFromLexoffice(detail: LexofficeSalesDetail): AccountingLineItem[] {
  const items = detail.lineItems ?? [];
  return items.map((raw, index) => {
    const type = String(raw.type ?? "custom");
    const unitPriceRaw = raw.unitPrice as Record<string, unknown> | undefined;
    const netAmount = Number(unitPriceRaw?.netAmount ?? 0);
    const grossAmount = Number(unitPriceRaw?.grossAmount ?? 0);
    const taxRate = Number(unitPriceRaw?.taxRatePercentage ?? 0);
    const quantity = Number(raw.quantity ?? 1);
    const unitPrice = netAmount || grossAmount;
    return {
      id: randomUUID(),
      sortOrder: index,
      type: type === "text" ? "text" : "custom",
      articleId: null,
      name: String(raw.name ?? ""),
      description: raw.description ? String(raw.description) : null,
      quantity,
      unitName: String(raw.unitName ?? "Stück"),
      unitPrice,
      taxRatePercent: taxRate,
      discountPercent: Number(raw.discountPercentage ?? 0),
      lineAmount: unitPrice * quantity,
    };
  });
}

function rowFromDetail(
  kind: "invoice" | "quotation",
  detail: LexofficeSalesDetail,
  listItem?: LexofficeVoucherListItem,
): Record<string, unknown> {
  const status = mapLexofficeVoucherStatus(
    detail.voucherStatus ?? listItem?.voucherStatus,
    kind,
  );
  const externalId = detail.id;
  return {
    source: "lexoffice",
    external_id: externalId,
    external_version: detail.version ?? null,
    external_edit_url: lexofficeEditUrl(kind, externalId),
    status,
    voucher_number: detail.voucherNumber ?? listItem?.voucherNumber ?? null,
    voucher_date: parseVoucherDate(detail.voucherDate ?? listItem?.voucherDate),
    due_date:
      kind === "invoice"
        ? optionalVoucherDate(detail.dueDate)
        : null,
    expiration_date:
      kind === "quotation"
        ? optionalVoucherDate(detail.expirationDate)
        : null,
    currency: detail.totalPrice?.currency ?? listItem?.currency ?? "EUR",
    tax_mode: mapLexofficeTaxMode(detail.taxConditions?.taxType),
    recipient_type: "one_time",
    contact_id: null,
    recipient_snapshot: recipientFromLexoffice(detail),
    line_items: lineItemsFromLexoffice(detail),
    totals: totalsFromLexoffice(detail),
    title: detail.title ?? null,
    introduction: detail.introduction ?? null,
    remark: detail.remark ?? null,
    finalize_on_create: false,
  };
}

export async function syncLexofficeSalesDocuments(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    kind: "invoice" | "quotation";
  },
): Promise<{ imported: number; updated: number; listed: number; error: string | null }> {
  const list = await fetchAllLexofficeVoucherList(
    params.restaurantId,
    params.kind,
  );
  if (!list.ok) {
    return { imported: 0, updated: 0, listed: 0, error: list.error };
  }

  const table =
    params.kind === "invoice" ? "accounting_invoices" : "accounting_quotations";

  const { data: existingRows } = await sb
    .from(table)
    .select("external_id, external_version")
    .eq("restaurant_id", params.restaurantId)
    .eq("source", "lexoffice")
    .not("external_id", "is", null);

  const versionByExternal = new Map<string, number | null>();
  for (const row of existingRows ?? []) {
    const ext = row.external_id as string | null;
    if (ext) {
      versionByExternal.set(ext, (row.external_version as number | null) ?? null);
    }
  }

  let imported = 0;
  let updated = 0;
  let detailFailures = 0;
  let writeFailures = 0;

  for (const item of list.items) {
    const knownVersion = versionByExternal.get(item.id);
    const detailResult = await fetchLexofficeSalesDetail(
      params.restaurantId,
      params.kind,
      item.id,
      item.voucherType,
    );
    if (!detailResult.ok) {
      detailFailures += 1;
      console.warn(
        "[gwada] syncLexofficeSalesDocuments detail",
        params.kind,
        item.id,
        detailResult.error,
      );
      continue;
    }

    const detail = detailResult.detail;
    const payload = rowFromDetail(params.kind, detail, item);
    payload.restaurant_id = params.restaurantId;
    payload.updated_by = params.userId;

    if (knownVersion === undefined) {
      payload.created_by = params.userId;
      const { error } = await sb.from(table).insert(payload);
      if (error) {
        writeFailures += 1;
        console.warn(
          "[gwada] syncLexofficeSalesDocuments insert",
          params.kind,
          item.id,
          error.message,
        );
      } else {
        imported += 1;
      }
    } else if (knownVersion !== (detail.version ?? null)) {
      const { error } = await sb
        .from(table)
        .update(payload)
        .eq("restaurant_id", params.restaurantId)
        .eq("source", "lexoffice")
        .eq("external_id", item.id);
      if (error) {
        writeFailures += 1;
        console.warn(
          "[gwada] syncLexofficeSalesDocuments update",
          params.kind,
          item.id,
          error.message,
        );
      } else {
        updated += 1;
      }
    }
  }

  await touchLexofficeSyncTimestamp(sb, params.restaurantId, params.kind);

  if (
    list.items.length > 0 &&
    imported === 0 &&
    updated === 0 &&
    (detailFailures > 0 || writeFailures > 0)
  ) {
    return {
      imported,
      updated,
      listed: list.items.length,
      error:
        detailFailures > 0
          ? "Lexware-Dokumente gefunden, Details konnten nicht geladen werden."
          : "Lexware-Dokumente konnten nicht gespeichert werden.",
    };
  }

  return { imported, updated, listed: list.items.length, error: null };
}
