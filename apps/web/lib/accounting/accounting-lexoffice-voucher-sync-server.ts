import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  connectorSyncCooldownLastAt,
  getAccountingSettings,
  touchConnectorSyncTimestamp,
} from "@/lib/accounting/accounting-settings-server";
import {
  connectorSyncWriteErrorMessage,
  resolveAccountingActorUserId,
} from "@/lib/accounting/accounting-connector-sync-db";
import {
  fetchLexofficeBookkeepingDetail,
  lexofficeBookkeepingEditUrl,
  lexofficeVoucherFileId,
  mapLexofficeBookkeepingStatus,
  mapLexofficeBookkeepingTypeToKind,
  voucherItemsFromLexoffice,
} from "@/lib/integrations/lexoffice-bookkeeping-vouchers";
import { LEXOFFICE_SYNC_COOLDOWN_MS } from "@/lib/integrations/lexoffice-api-cache";
import { invalidateLexofficeCachePrefix } from "@/lib/integrations/lexoffice-api-cache";
import {
  fetchAllLexofficeBookkeepingVoucherList,
  type LexofficeVoucherListItem,
} from "@/lib/integrations/lexoffice-voucherlist";
import type { AccountingVoucherRow } from "@/lib/types/accounting";
import {
  insertAccountingDocumentLog,
  voucherCreatedLogSummary,
} from "@/lib/accounting/accounting-document-log-server";

export type LexofficeVoucherSyncResult = {
  imported: number;
  updated: number;
  listed: number;
  skipped?: boolean;
  error: string | null;
};

type ExistingLexofficeVoucher = {
  id: string;
  external_id: string;
  external_updated_at: string | null;
  voucher_items: AccountingVoucherRow["voucher_items"];
  total_tax_amount: number;
  /** null = Anhang noch nicht geprüft, "" = geprüft ohne Datei, UUID = File-ID */
  file_name: string | null;
};

function parseVoucherDate(isoOrDate: string | undefined): string {
  if (!isoOrDate) return new Date().toISOString().slice(0, 10);
  return isoOrDate.slice(0, 10);
}

function optionalVoucherDate(isoOrDate: string | null | undefined): string | null {
  if (!isoOrDate) return null;
  return isoOrDate.slice(0, 10);
}

function mapLexofficeVoucherTaxMode(taxType: string | undefined): "net" | "gross" {
  return taxType === "gross" ? "gross" : "net";
}

function listItemUpdatedAt(item: LexofficeVoucherListItem): string | null {
  return item.updatedDate ?? null;
}

function isLexofficeBookkeepingCorrectionType(
  type: string | undefined,
): boolean {
  const t = (type ?? "").toLowerCase();
  return t === "purchasecreditnote" || t === "salescreditnote";
}

function voucherPatchFromLexofficeDetail(
  detail: import("@/lib/integrations/lexoffice-bookkeeping-vouchers").LexofficeBookkeepingDetail,
  listItem?: LexofficeVoucherListItem,
): Record<string, unknown> {
  const items = voucherItemsFromLexoffice(detail);
  const firstFileId = lexofficeVoucherFileId(detail.files);

  const lexType = detail.type ?? listItem?.voucherType;

  return {
    voucher_kind: mapLexofficeBookkeepingTypeToKind(lexType),
    document_variant: isLexofficeBookkeepingCorrectionType(lexType)
      ? "correction"
      : "standard",
    status: mapLexofficeBookkeepingStatus(
      detail.voucherStatus ?? listItem?.voucherStatus,
    ),
    voucher_number: detail.voucherNumber ?? listItem?.voucherNumber ?? null,
    voucher_date: parseVoucherDate(detail.voucherDate ?? listItem?.voucherDate),
    due_date: optionalVoucherDate(detail.dueDate ?? listItem?.dueDate),
    shipping_date: optionalVoucherDate(detail.shippingDate),
    tax_mode: mapLexofficeVoucherTaxMode(detail.taxType),
    use_collective_contact:
      detail.useCollectiveContact ?? !listItem?.contactId,
    contact_id: detail.contactId ?? listItem?.contactId ?? null,
    contact_name: detail.contactName ?? listItem?.contactName ?? null,
    total_gross_amount: Number(
      detail.totalGrossAmount ?? listItem?.totalAmount ?? 0,
    ),
    total_tax_amount: Number(detail.totalTaxAmount ?? 0),
    voucher_items: items,
    remark: detail.remark ?? null,
    external_version: detail.version ?? null,
    file_name: firstFileId ?? "",
    mime_type: firstFileId ? "lexoffice/file" : null,
  };
}

function listOnlyPatch(
  item: LexofficeVoucherListItem,
): Record<string, unknown> {
  return {
    voucher_kind: mapLexofficeBookkeepingTypeToKind(item.voucherType),
    document_variant: isLexofficeBookkeepingCorrectionType(item.voucherType)
      ? "correction"
      : "standard",
    status: mapLexofficeBookkeepingStatus(item.voucherStatus),
    voucher_number: item.voucherNumber ?? null,
    voucher_date: parseVoucherDate(item.voucherDate),
    due_date: optionalVoucherDate(item.dueDate),
    contact_id: item.contactId ?? null,
    contact_name: item.contactName ?? null,
    total_gross_amount: Number(item.totalAmount ?? 0),
    use_collective_contact: !item.contactId,
    currency: item.currency ?? "EUR",
    external_updated_at: listItemUpdatedAt(item),
  };
}

function needsDetailFetch(
  item: LexofficeVoucherListItem,
  existing: ExistingLexofficeVoucher | undefined,
  isNew: boolean,
): boolean {
  if (isNew || !existing) return true;
  if (!existing.voucher_items?.length) return true;
  if (
    existing.total_tax_amount === 0 &&
    Number(item.totalAmount ?? 0) > 0
  ) {
    return true;
  }
  if (existing.file_name === null) return true;
  const listUpdated = listItemUpdatedAt(item);
  if (!listUpdated) return false;
  if (!existing.external_updated_at) return true;
  return (
    new Date(listUpdated).getTime() >
    new Date(existing.external_updated_at).getTime()
  );
}

async function buildVoucherPayload(
  restaurantId: string,
  item: LexofficeVoucherListItem,
  existing: ExistingLexofficeVoucher | undefined,
  isNew: boolean,
): Promise<{ payload: Record<string, unknown>; detailFetched: boolean }> {
  const base: Record<string, unknown> = {
    source: "lexoffice",
    external_id: item.id,
    external_edit_url: lexofficeBookkeepingEditUrl(item.id),
    ...listOnlyPatch(item),
  };

  if (!needsDetailFetch(item, existing, isNew)) {
    return { payload: base, detailFetched: false };
  }

  const detail = await fetchLexofficeBookkeepingDetail(restaurantId, item.id);
  if (detail.ok) {
    Object.assign(base, voucherPatchFromLexofficeDetail(detail.detail, item));
    base.external_updated_at = listItemUpdatedAt(item);
    return { payload: base, detailFetched: true };
  }

  return { payload: base, detailFetched: false };
}

export async function enrichLexofficeVoucherRow(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    row: AccountingVoucherRow;
    userId?: string;
    force?: boolean;
  },
): Promise<AccountingVoucherRow> {
  const { row, restaurantId } = params;
  if (row.source !== "lexoffice" || !row.external_id) {
    return row;
  }

  const needsEnrich =
    params.force ||
    !row.voucher_items?.length ||
    (row.total_tax_amount === 0 && row.total_gross_amount > 0) ||
    row.file_name === null;

  if (!needsEnrich) {
    return row;
  }

  const detail = await fetchLexofficeBookkeepingDetail(
    restaurantId,
    row.external_id,
    { skipCache: params.force },
  );
  if (!detail.ok) {
    return row;
  }

  const patch = voucherPatchFromLexofficeDetail(detail.detail);
  patch.updated_by = params.userId ?? row.updated_by;

  const { data, error } = await sb
    .from("accounting_vouchers")
    .update(patch)
    .eq("restaurant_id", restaurantId)
    .eq("id", row.id)
    .select("*")
    .single();

  if (error || !data) {
    return row;
  }

  return data as AccountingVoucherRow;
}

export async function syncLexofficeBookkeepingVouchers(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string; force?: boolean },
): Promise<LexofficeVoucherSyncResult> {
  const settings = await getAccountingSettings(sb, params.restaurantId);
  const lastSyncAt = connectorSyncCooldownLastAt(
    settings,
    "lexoffice",
    "vouchers",
  );
  if (!params.force && lastSyncAt) {
    const elapsed = Date.now() - new Date(lastSyncAt).getTime();
    if (elapsed < LEXOFFICE_SYNC_COOLDOWN_MS) {
      return {
        imported: 0,
        updated: 0,
        listed: 0,
        skipped: true,
        error: null,
      };
    }
  }

  const list = await fetchAllLexofficeBookkeepingVoucherList(
    params.restaurantId,
    { skipCache: params.force },
  );
  if (!list.ok) {
    return { imported: 0, updated: 0, listed: 0, error: list.error };
  }

  const actorUserId = await resolveAccountingActorUserId(sb, params.userId);

  const { data: existingRows, error: existingRowsError } = await sb
    .from("accounting_vouchers")
    .select(
      "id, external_id, external_updated_at, voucher_items, total_tax_amount, file_name",
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("source", "lexoffice")
    .not("external_id", "is", null);

  if (existingRowsError) {
    return {
      imported: 0,
      updated: 0,
      listed: list.items.length,
      error: connectorSyncWriteErrorMessage(
        "Lexware-Belege",
        existingRowsError.message,
      ),
    };
  }

  const existingByExternalId = new Map<string, ExistingLexofficeVoucher>();
  for (const row of existingRows ?? []) {
    const ext = row.external_id as string | null;
    if (!ext) continue;
    existingByExternalId.set(ext, {
      id: row.id as string,
      external_id: ext,
      external_updated_at: (row.external_updated_at as string | null) ?? null,
      voucher_items: (row.voucher_items ??
        []) as AccountingVoucherRow["voucher_items"],
      total_tax_amount: Number(row.total_tax_amount ?? 0),
      file_name: (row.file_name as string | null) ?? null,
    });
  }

  let imported = 0;
  let updated = 0;
  let writeFailures = 0;
  let firstWriteError: string | null = null;

  const noteWriteFailure = (message: string | undefined) => {
    writeFailures += 1;
    if (!firstWriteError && message) firstWriteError = message;
  };

  for (const item of list.items) {
    const existing = existingByExternalId.get(item.id);
    const isNew = !existing;
    const { payload, detailFetched } = await buildVoucherPayload(
      params.restaurantId,
      item,
      existing,
      isNew,
    );
    payload.restaurant_id = params.restaurantId;
    if (actorUserId) {
      payload.updated_by = actorUserId;
    }

    if (isNew) {
      if (actorUserId) {
        payload.created_by = actorUserId;
      }
      const { error } = await sb.from("accounting_vouchers").insert(payload);
      if (error) {
        noteWriteFailure(error.message);
        console.warn(
          "[gwada] syncLexofficeBookkeepingVouchers insert",
          item.id,
          error.message,
        );
      } else {
        imported += 1;
        const { data: inserted } = await sb
          .from("accounting_vouchers")
          .select("id, voucher_number, document_variant, source")
          .eq("restaurant_id", params.restaurantId)
          .eq("source", "lexoffice")
          .eq("external_id", item.id)
          .maybeSingle();
        if (inserted) {
          existingByExternalId.set(item.id, {
            id: inserted.id as string,
            external_id: item.id,
            external_updated_at:
              (payload.external_updated_at as string | null) ?? null,
            voucher_items: (payload.voucher_items ??
              []) as AccountingVoucherRow["voucher_items"],
            total_tax_amount: Number(payload.total_tax_amount ?? 0),
            file_name: (payload.file_name as string | null) ?? null,
          });
          await insertAccountingDocumentLog(sb, {
            restaurantId: params.restaurantId,
            documentKind: "voucher",
            documentId: inserted.id as string,
            actorUserId,
            action: "created",
            details: {
              source: "lexoffice",
              voucherNumber: inserted.voucher_number as string | null,
              documentVariant: inserted.document_variant as string | null,
              summary: voucherCreatedLogSummary({
                source: "lexoffice",
                voucherNumber: inserted.voucher_number as string | null,
                documentVariant: inserted.document_variant as string | null,
              }),
            },
          });
        }
      }
    } else {
      const { error } = await sb
        .from("accounting_vouchers")
        .update(payload)
        .eq("restaurant_id", params.restaurantId)
        .eq("source", "lexoffice")
        .eq("external_id", item.id);
      if (error) {
        noteWriteFailure(error.message);
        console.warn(
          "[gwada] syncLexofficeBookkeepingVouchers update",
          item.id,
          error.message,
        );
      } else {
        updated += 1;
        if (detailFetched && existing) {
          await insertAccountingDocumentLog(sb, {
            restaurantId: params.restaurantId,
            documentKind: "voucher",
            documentId: existing.id,
            actorUserId,
            action: "synced",
            details: {
              source: "lexoffice",
              voucherNumber: item.voucherNumber,
              summary: "Belegdetails aus Lexware aktualisiert",
            },
          });
        }
      }
    }
  }

  if (params.force) {
    invalidateLexofficeCachePrefix(params.restaurantId, "/v1/voucherlist");
    invalidateLexofficeCachePrefix(params.restaurantId, "/v1/vouchers/");
  }

  await touchConnectorSyncTimestamp(
    sb,
    params.restaurantId,
    "lexoffice",
    "vouchers",
  );

  if (list.items.length > 0 && imported === 0 && updated === 0 && writeFailures > 0) {
    return {
      imported,
      updated,
      listed: list.items.length,
      error: connectorSyncWriteErrorMessage(
        "Lexware-Belege",
        firstWriteError,
      ),
    };
  }

  return { imported, updated, listed: list.items.length, error: null };
}
