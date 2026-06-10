import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { touchLexofficeSyncTimestamp } from "@/lib/accounting/accounting-settings-server";
import {
  fetchLexofficeBookkeepingDetail,
  lexofficeBookkeepingEditUrl,
  mapLexofficeBookkeepingStatus,
  mapLexofficeBookkeepingTypeToKind,
  voucherItemsFromLexoffice,
} from "@/lib/integrations/lexoffice-bookkeeping-vouchers";
import {
  fetchAllLexofficeBookkeepingVoucherList,
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

function rowFromLexofficeDetail(
  detail: Awaited<
    ReturnType<typeof fetchLexofficeBookkeepingDetail>
  > extends { ok: true; detail: infer D }
    ? D
    : never,
  listItem?: LexofficeVoucherListItem,
): Record<string, unknown> {
  const items = voucherItemsFromLexoffice(detail);
  return {
    source: "lexoffice",
    external_id: detail.id,
    external_version: detail.version ?? null,
    external_edit_url: lexofficeBookkeepingEditUrl(detail.id),
    voucher_kind: mapLexofficeBookkeepingTypeToKind(detail.type ?? listItem?.voucherType),
    status: mapLexofficeBookkeepingStatus(
      detail.voucherStatus ?? listItem?.voucherStatus,
    ),
    voucher_number: detail.voucherNumber ?? listItem?.voucherNumber ?? null,
    voucher_date: parseVoucherDate(detail.voucherDate ?? listItem?.voucherDate),
    due_date: optionalVoucherDate(detail.dueDate),
    shipping_date: optionalVoucherDate(detail.shippingDate),
    currency: listItem?.currency ?? "EUR",
    tax_mode: detail.taxType === "net" ? "net" : "gross",
    use_collective_contact: detail.useCollectiveContact !== false,
    contact_id: detail.contactId ?? null,
    contact_name: detail.contactName ?? listItem?.contactName ?? null,
    total_gross_amount: Number(detail.totalGrossAmount ?? listItem?.totalAmount ?? 0),
    total_tax_amount: Number(detail.totalTaxAmount ?? 0),
    voucher_items: items,
    remark: detail.remark ?? null,
  };
}

export async function syncLexofficeBookkeepingVouchers(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ imported: number; updated: number; listed: number; error: string | null }> {
  const list = await fetchAllLexofficeBookkeepingVoucherList(params.restaurantId);
  if (!list.ok) {
    return { imported: 0, updated: 0, listed: 0, error: list.error };
  }

  const { data: existingRows } = await sb
    .from("accounting_vouchers")
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
    const detailResult = await fetchLexofficeBookkeepingDetail(
      params.restaurantId,
      item.id,
    );
    if (!detailResult.ok) {
      detailFailures += 1;
      console.warn(
        "[gwada] syncLexofficeBookkeepingVouchers detail",
        item.id,
        detailResult.error,
      );
      continue;
    }

    const payload = rowFromLexofficeDetail(detailResult.detail, item);
    payload.restaurant_id = params.restaurantId;
    payload.updated_by = params.userId;

    if (knownVersion === undefined) {
      payload.created_by = params.userId;
      const { error } = await sb.from("accounting_vouchers").insert(payload);
      if (error) {
        writeFailures += 1;
        console.warn(
          "[gwada] syncLexofficeBookkeepingVouchers insert",
          item.id,
          error.message,
        );
      } else {
        imported += 1;
      }
    } else if (knownVersion !== (detailResult.detail.version ?? null)) {
      const { error } = await sb
        .from("accounting_vouchers")
        .update(payload)
        .eq("restaurant_id", params.restaurantId)
        .eq("source", "lexoffice")
        .eq("external_id", item.id);
      if (error) {
        writeFailures += 1;
        console.warn(
          "[gwada] syncLexofficeBookkeepingVouchers update",
          item.id,
          error.message,
        );
      } else {
        updated += 1;
      }
    }
  }

  await touchLexofficeSyncTimestamp(sb, params.restaurantId, "voucher");

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
          ? "Lexware-Belege gefunden, Details konnten nicht geladen werden."
          : "Lexware-Belege konnten nicht gespeichert werden.",
    };
  }

  return { imported, updated, listed: list.items.length, error: null };
}
