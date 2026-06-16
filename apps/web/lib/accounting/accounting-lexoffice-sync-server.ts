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
import { salesDocumentKindToSyncScope } from "@/lib/accounting/accounting-connector-settings";
import {
  invalidateLexofficeCachePrefix,
  LEXOFFICE_SYNC_COOLDOWN_MS,
} from "@/lib/integrations/lexoffice-api-cache";
import {
  listTotalsFallbackFromListItem,
  salesDocumentPatchFromLexofficeDetail,
  coerceLexofficeExternalVersion,
} from "@/lib/integrations/lexoffice-sales-detail-map";
import {
  insertAccountingDocumentLog,
  salesDocumentCreatedLogSummary,
} from "@/lib/accounting/accounting-document-log-server";
import {
  fetchAllLexofficeVoucherList,
  fetchLexofficeSalesDetail,
  lexofficeEditUrl,
  mapLexofficeVoucherStatus,
  type LexofficeVoucherListItem,
} from "@/lib/integrations/lexoffice-voucherlist";
import type {
  AccountingLineItem,
  AccountingTotals,
} from "@/lib/types/accounting";

const LEXWARE_APP_BASE = "https://app.lexware.de";

function parseVoucherDate(isoOrDate: string | undefined): string {
  if (!isoOrDate) return new Date().toISOString().slice(0, 10);
  return isoOrDate.slice(0, 10);
}

function optionalVoucherDate(isoOrDate: string | null | undefined): string | null {
  if (!isoOrDate) return null;
  return isoOrDate.slice(0, 10);
}

function listItemUpdatedAt(item: LexofficeVoucherListItem): string | null {
  return item.updatedDate ?? null;
}

function isCreditNoteListItem(
  kind: "invoice" | "quotation",
  item: LexofficeVoucherListItem,
): boolean {
  return (
    kind === "invoice" &&
    (item.voucherType ?? "").toLowerCase() === "creditnote"
  );
}

type ExistingLexofficeSalesDocument = {
  id: string;
  external_id: string;
  external_updated_at: string | null;
  line_items: AccountingLineItem[];
  totals: AccountingTotals | null;
};

function listOnlySalesPatch(
  kind: "invoice" | "quotation",
  item: LexofficeVoucherListItem,
): Record<string, unknown> {
  const currency = item.currency ?? "EUR";
  const patch: Record<string, unknown> = {
    status: mapLexofficeVoucherStatus(item.voucherStatus, kind),
    voucher_number: item.voucherNumber ?? null,
    voucher_date: parseVoucherDate(item.voucherDate),
    currency,
    recipient_type: "one_time",
    contact_id: null,
    recipient_snapshot: {
      name: item.contactName?.trim() || "Unbenannt",
      supplement: null,
      street: null,
      city: null,
      zip: null,
      countryCode: "DE",
    },
    external_updated_at: listItemUpdatedAt(item),
  };

  if (kind === "invoice") {
    patch.due_date = optionalVoucherDate(item.dueDate);
  }

  return patch;
}

function salesDocumentShellFromListItem(
  kind: "invoice" | "quotation",
  item: LexofficeVoucherListItem,
): Record<string, unknown> {
  const isCreditNote = isCreditNoteListItem(kind, item);

  const shell: Record<string, unknown> = {
    source: "lexoffice",
    external_id: item.id,
    external_version: null,
    external_edit_url: isCreditNote
      ? `${LEXWARE_APP_BASE}/permalink/credit-notes/edit/${item.id}`
      : lexofficeEditUrl(kind, item.id),
    finalize_on_create: false,
    ...listOnlySalesPatch(kind, item),
    line_items: [],
    totals: listTotalsFallbackFromListItem(item),
    title: null,
    introduction: null,
    remark: null,
    ...(kind === "quotation" ? { expiration_date: null } : {}),
  };

  /** Korrektur-Metadaten nur auf accounting_invoices — nicht auf accounting_quotations. */
  if (kind === "invoice") {
    shell.external_document_type = isCreditNote ? "credit_note" : kind;
    shell.document_variant = isCreditNote ? "correction" : "standard";
    shell.corrects_id = null;
  }

  return shell;
}

function needsSalesDetailFetch(
  item: LexofficeVoucherListItem,
  existing: ExistingLexofficeSalesDocument | undefined,
  isNew: boolean,
): boolean {
  if (isNew || !existing) return true;
  if (!existing.line_items?.length) return true;
  const totalTax = existing.totals?.totalTax ?? 0;
  if (totalTax === 0 && Number(item.totalAmount ?? 0) > 0) return true;
  const listUpdated = listItemUpdatedAt(item);
  if (!listUpdated) return false;
  if (!existing.external_updated_at) return true;
  return (
    new Date(listUpdated).getTime() >
    new Date(existing.external_updated_at).getTime()
  );
}

async function buildSalesDocumentPayload(
  restaurantId: string,
  kind: "invoice" | "quotation",
  item: LexofficeVoucherListItem,
  existing: ExistingLexofficeSalesDocument | undefined,
  isNew: boolean,
  opts?: { skipDetailCache?: boolean },
): Promise<{ payload: Record<string, unknown>; detailFetched: boolean }> {
  if (!needsSalesDetailFetch(item, existing, isNew)) {
    return { payload: listOnlySalesPatch(kind, item), detailFetched: false };
  }

  const detail = await fetchLexofficeSalesDetail(
    restaurantId,
    kind,
    item.id,
    item.voucherType,
    { skipCache: opts?.skipDetailCache },
  );

  if (!detail.ok) {
    return {
      payload: isNew
        ? salesDocumentShellFromListItem(kind, item)
        : listOnlySalesPatch(kind, item),
      detailFetched: false,
    };
  }

  const detailPatch = salesDocumentPatchFromLexofficeDetail(
    kind,
    detail.detail,
    item,
  );

  if (isNew) {
    return {
      payload: {
        ...salesDocumentShellFromListItem(kind, item),
        ...detailPatch,
        external_updated_at: listItemUpdatedAt(item),
      },
      detailFetched: true,
    };
  }

  const isCreditNote = isCreditNoteListItem(kind, item);
  return {
    payload: {
      ...listOnlySalesPatch(kind, item),
      ...detailPatch,
      external_version: coerceLexofficeExternalVersion(detail.detail.version),
      ...(isCreditNote
        ? {
            external_document_type: "credit_note",
            document_variant: "correction",
            external_edit_url: `${LEXWARE_APP_BASE}/permalink/credit-notes/edit/${item.id}`,
          }
        : {}),
      external_updated_at: listItemUpdatedAt(item),
    },
    detailFetched: true,
  };
}

export async function syncLexofficeSalesDocuments(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    kind: "invoice" | "quotation";
    force?: boolean;
  },
): Promise<{
  imported: number;
  updated: number;
  listed: number;
  skipped?: boolean;
  error: string | null;
}> {
  const settings = await getAccountingSettings(sb, params.restaurantId);
  const scope = salesDocumentKindToSyncScope(params.kind);
  const lastSyncAt = connectorSyncCooldownLastAt(
    settings,
    "lexoffice",
    scope,
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

  const list = await fetchAllLexofficeVoucherList(
    params.restaurantId,
    params.kind,
    { skipCache: params.force },
  );
  if (!list.ok) {
    return { imported: 0, updated: 0, listed: 0, error: list.error };
  }

  const actorUserId = await resolveAccountingActorUserId(sb, params.userId);

  const table =
    params.kind === "invoice" ? "accounting_invoices" : "accounting_quotations";

  const { data: existingRows, error: existingRowsError } = await sb
    .from(table)
    .select("id, external_id, external_updated_at, line_items, totals")
    .eq("restaurant_id", params.restaurantId)
    .eq("source", "lexoffice")
    .not("external_id", "is", null);

  if (existingRowsError) {
    return {
      imported: 0,
      updated: 0,
      listed: list.items.length,
      error: connectorSyncWriteErrorMessage(
        "Lexware-Dokumente",
        existingRowsError.message,
      ),
    };
  }

  const existingByExternalId = new Map<string, ExistingLexofficeSalesDocument>();
  for (const row of existingRows ?? []) {
    const ext = row.external_id as string | null;
    if (!ext) continue;
    existingByExternalId.set(ext, {
      id: row.id as string,
      external_id: ext,
      external_updated_at: (row.external_updated_at as string | null) ?? null,
      line_items: (row.line_items ?? []) as AccountingLineItem[],
      totals: (row.totals as AccountingTotals | null) ?? null,
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
    const { payload, detailFetched } = await buildSalesDocumentPayload(
      params.restaurantId,
      params.kind,
      item,
      existing,
      isNew,
      { skipDetailCache: params.force },
    );
    payload.restaurant_id = params.restaurantId;
    if (actorUserId) {
      payload.updated_by = actorUserId;
    }

    if (isNew) {
      if (actorUserId) {
        payload.created_by = actorUserId;
      }
      const { error } = await sb.from(table).insert(payload);
      if (error) {
        noteWriteFailure(error.message);
        console.warn(
          "[gwada] syncLexofficeSalesDocuments insert",
          params.kind,
          item.id,
          error.message,
        );
      } else {
        imported += 1;
        const insertedFilter = {
          restaurantId: params.restaurantId,
          externalId: item.id,
        };
        const { data: inserted } =
          params.kind === "invoice"
            ? await sb
                .from(table)
                .select("id, voucher_number, document_variant, source")
                .eq("restaurant_id", insertedFilter.restaurantId)
                .eq("source", "lexoffice")
                .eq("external_id", insertedFilter.externalId)
                .maybeSingle()
            : await sb
                .from(table)
                .select("id, voucher_number, source")
                .eq("restaurant_id", insertedFilter.restaurantId)
                .eq("source", "lexoffice")
                .eq("external_id", insertedFilter.externalId)
                .maybeSingle();
        if (inserted) {
          const documentVariant =
            params.kind === "invoice"
              ? ((inserted as { document_variant?: string | null })
                  .document_variant ?? null)
              : null;
          existingByExternalId.set(item.id, {
            id: inserted.id as string,
            external_id: item.id,
            external_updated_at:
              (payload.external_updated_at as string | null) ?? null,
            line_items: (payload.line_items ?? []) as AccountingLineItem[],
            totals: (payload.totals as AccountingTotals | null) ?? null,
          });
          await insertAccountingDocumentLog(sb, {
            restaurantId: params.restaurantId,
            documentKind: params.kind,
            documentId: inserted.id as string,
            actorUserId,
            action: "created",
            details: {
              source: "lexoffice",
              voucherNumber: inserted.voucher_number as string | null,
              documentVariant,
              summary: salesDocumentCreatedLogSummary(params.kind, {
                source: "lexoffice",
                voucherNumber: inserted.voucher_number as string | null,
                documentVariant,
              }),
            },
          });
        }
      }
    } else {
      const { error } = await sb
        .from(table)
        .update(payload)
        .eq("restaurant_id", params.restaurantId)
        .eq("source", "lexoffice")
        .eq("external_id", item.id);
      if (error) {
        noteWriteFailure(error.message);
        console.warn(
          "[gwada] syncLexofficeSalesDocuments update",
          params.kind,
          item.id,
          error.message,
        );
      } else {
        updated += 1;
        existingByExternalId.set(item.id, {
          id: existing!.id,
          external_id: item.id,
          external_updated_at:
            (payload.external_updated_at as string | null) ??
            existing!.external_updated_at,
          line_items:
            (payload.line_items as AccountingLineItem[] | undefined) ??
            existing!.line_items,
          totals:
            (payload.totals as AccountingTotals | null | undefined) ??
            existing!.totals,
        });
        if (detailFetched && existing) {
          await insertAccountingDocumentLog(sb, {
            restaurantId: params.restaurantId,
            documentKind: params.kind,
            documentId: existing.id,
            actorUserId,
            action: "synced",
            details: {
              source: "lexoffice",
              voucherNumber: item.voucherNumber,
              summary: "Positionen und Details aus Lexware aktualisiert",
            },
          });
        }
      }
    }
  }

  if (params.force) {
    invalidateLexofficeCachePrefix(params.restaurantId, "/v1/voucherlist");
    invalidateLexofficeCachePrefix(params.restaurantId, "/v1/invoices/");
    invalidateLexofficeCachePrefix(params.restaurantId, "/v1/quotations/");
    invalidateLexofficeCachePrefix(params.restaurantId, "/v1/credit-notes/");
  }

  await touchConnectorSyncTimestamp(
    sb,
    params.restaurantId,
    "lexoffice",
    scope,
  );

  if (list.items.length > 0 && imported === 0 && updated === 0 && writeFailures > 0) {
    return {
      imported,
      updated,
      listed: list.items.length,
      error: connectorSyncWriteErrorMessage(
        "Lexware-Dokumente",
        firstWriteError,
      ),
    };
  }

  return { imported, updated, listed: list.items.length, error: null };
}

function lexofficeListVoucherTypeForRow(
  kind: "invoice" | "quotation",
  row: {
    external_document_type: string | null;
  },
): string {
  if (kind === "quotation") return "quotation";
  if (row.external_document_type === "credit_note") return "creditnote";
  return "invoice";
}

export async function enrichLexofficeSalesDocumentRow<
  T extends {
    id: string;
    source: string;
    external_id: string | null;
    line_items: AccountingLineItem[];
    totals: AccountingTotals | null;
    external_document_type: string | null;
    updated_by: string | null;
  },
>(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    kind: "invoice" | "quotation";
    row: T;
    userId?: string;
    force?: boolean;
  },
): Promise<T> {
  const { row, restaurantId, kind } = params;
  if (row.source !== "lexoffice" || !row.external_id) {
    return row;
  }

  const needsEnrich =
    params.force ||
    !row.line_items?.length ||
    ((row.totals?.totalTax ?? 0) === 0 &&
      (row.totals?.totalGross ?? 0) > 0);

  if (!needsEnrich) {
    return row;
  }

  const lexType = lexofficeListVoucherTypeForRow(kind, row);
  const detail = await fetchLexofficeSalesDetail(
    restaurantId,
    kind,
    row.external_id,
    lexType,
    { skipCache: params.force },
  );
  if (!detail.ok) {
    return row;
  }

  const table =
    kind === "invoice" ? "accounting_invoices" : "accounting_quotations";

  const patch = {
    ...salesDocumentPatchFromLexofficeDetail(kind, detail.detail),
    external_version: coerceLexofficeExternalVersion(detail.detail.version),
    updated_by: params.userId ?? row.updated_by,
  };

  const { data, error } = await sb
    .from(table)
    .update(patch)
    .eq("restaurant_id", restaurantId)
    .eq("id", row.id)
    .select("*")
    .single();

  if (error || !data) {
    return row;
  }

  return data as T;
}
