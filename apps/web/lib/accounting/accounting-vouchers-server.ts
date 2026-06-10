import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ACCOUNTING_VOUCHERS_STORAGE_BUCKET,
  buildAccountingVoucherStoragePath,
} from "@/lib/accounting/accounting-voucher-storage";
import {
  computeVoucherTotals,
  normalizeVoucherItems,
} from "@/lib/accounting/compute-voucher-totals";
import {
  createLexofficeBookkeepingVoucher,
  uploadLexofficeBookkeepingVoucherFile,
} from "@/lib/integrations/lexoffice-bookkeeping-vouchers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AccountingVoucherInput,
  AccountingVoucherRow,
} from "@/lib/types/accounting";

function mapVoucherRow(data: Record<string, unknown>): AccountingVoucherRow {
  return data as unknown as AccountingVoucherRow;
}

export async function listAccountingVouchers(
  sb: SupabaseClient,
  restaurantId: string,
  source?: string | null,
): Promise<AccountingVoucherRow[]> {
  let q = sb
    .from("accounting_vouchers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("voucher_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (source && source !== "all") {
    q = q.eq("source", source);
  }

  const { data, error } = await q;
  if (error) {
    console.warn("listAccountingVouchers", error.message);
    return [];
  }
  return (data ?? []).map((row) => mapVoucherRow(row as Record<string, unknown>));
}

export async function getAccountingVoucher(
  sb: SupabaseClient,
  restaurantId: string,
  voucherId: string,
): Promise<AccountingVoucherRow | null> {
  const { data, error } = await sb
    .from("accounting_vouchers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", voucherId)
    .maybeSingle();

  if (error || !data) return null;
  return mapVoucherRow(data as Record<string, unknown>);
}

export async function createAccountingVoucher(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    input: AccountingVoucherInput;
    file?: { buffer: Buffer; fileName: string; mimeType: string; sizeBytes: number };
  },
): Promise<{ row: AccountingVoucherRow | null; error: string | null }> {
  const items = normalizeVoucherItems(
    params.input.voucherItems,
    params.input.taxMode,
  );
  const totals = computeVoucherTotals(items, params.input.taxMode);

  let source: "gwada" | "lexoffice" = "gwada";
  let externalId: string | null = null;
  let externalVersion: number | null = null;
  let externalEditUrl: string | null = null;
  let voucherNumber = params.input.voucherNumber?.trim() || null;
  let status = params.input.status ?? "open";

  if (params.input.syncToLexoffice) {
    const created = await createLexofficeBookkeepingVoucher(
      params.restaurantId,
      params.input,
      items,
      totals,
    );
    if (!created.ok) {
      return { row: null, error: created.error };
    }
    source = "lexoffice";
    externalId = created.externalId;
    externalVersion = created.externalVersion;
    externalEditUrl = created.externalEditUrl;
    voucherNumber = created.voucherNumber;
    status = created.status as AccountingVoucherRow["status"];

    if (params.file) {
      const uploaded = await uploadLexofficeBookkeepingVoucherFile(
        params.restaurantId,
        created.externalId,
        params.file,
      );
      if (!uploaded.ok) {
        console.warn("[gwada] uploadLexofficeBookkeepingVoucherFile", uploaded.error);
      }
    }
  }

  const voucherId = randomUUID();
  let storagePath: string | null = null;
  let fileName: string | null = null;
  let mimeType: string | null = null;
  let sizeBytes: number | null = null;

  if (params.file && !params.input.syncToLexoffice) {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { row: null, error: "Storage nicht verfügbar." };
    }
    storagePath = buildAccountingVoucherStoragePath({
      restaurantId: params.restaurantId,
      voucherId,
      fileName: params.file.fileName,
    });
    const { error: uploadError } = await admin.storage
      .from(ACCOUNTING_VOUCHERS_STORAGE_BUCKET)
      .upload(storagePath, params.file.buffer, {
        contentType: params.file.mimeType,
        upsert: false,
      });
    if (uploadError) {
      return { row: null, error: uploadError.message };
    }
    fileName = params.file.fileName;
    mimeType = params.file.mimeType;
    sizeBytes = params.file.sizeBytes;
  }

  const { data, error } = await sb
    .from("accounting_vouchers")
    .insert({
      id: voucherId,
      restaurant_id: params.restaurantId,
      source,
      external_id: externalId,
      external_version: externalVersion,
      external_edit_url: externalEditUrl,
      voucher_kind: params.input.voucherKind,
      status,
      voucher_number: voucherNumber,
      voucher_date: params.input.voucherDate,
      due_date: params.input.dueDate ?? null,
      shipping_date: params.input.shippingDate ?? null,
      currency: params.input.currency ?? "EUR",
      tax_mode: params.input.taxMode,
      use_collective_contact: !(params.input.contactId || params.input.lexofficeContactId),
      contact_id: params.input.contactId ?? null,
      contact_name: params.input.contactName?.trim() || null,
      total_gross_amount: totals.totalGross,
      total_tax_amount: totals.totalTax,
      voucher_items: items,
      remark: params.input.remark?.trim() || null,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      created_by: params.userId,
      updated_by: params.userId,
    })
    .select("*")
    .single();

  if (error) {
    if (storagePath) {
      const admin = createSupabaseAdminClient();
      await admin?.storage
        .from(ACCOUNTING_VOUCHERS_STORAGE_BUCKET)
        .remove([storagePath]);
    }
    return { row: null, error: error.message };
  }

  return { row: mapVoucherRow(data as Record<string, unknown>), error: null };
}

export async function updateAccountingVoucher(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    voucherId: string;
    userId: string;
    input: Partial<AccountingVoucherInput> & {
      status?: AccountingVoucherRow["status"];
    };
  },
): Promise<{ row: AccountingVoucherRow | null; error: string | null }> {
  const existing = await getAccountingVoucher(
    sb,
    params.restaurantId,
    params.voucherId,
  );
  if (!existing) return { row: null, error: "Beleg nicht gefunden." };
  if (existing.source === "lexoffice") {
    return {
      row: null,
      error: "Lexware-Belege können nur in Lexware bearbeitet werden.",
    };
  }

  const taxMode = params.input.taxMode ?? existing.tax_mode;
  const items = params.input.voucherItems
    ? normalizeVoucherItems(params.input.voucherItems, taxMode)
    : existing.voucher_items;
  const totals = computeVoucherTotals(items, taxMode);

  const patch: Record<string, unknown> = {
    voucher_items: items,
    total_gross_amount: totals.totalGross,
    total_tax_amount: totals.totalTax,
    tax_mode: taxMode,
    updated_by: params.userId,
  };

  if (params.input.voucherKind) patch.voucher_kind = params.input.voucherKind;
  if (params.input.voucherDate) patch.voucher_date = params.input.voucherDate;
  if (params.input.dueDate !== undefined) patch.due_date = params.input.dueDate;
  if (params.input.shippingDate !== undefined) {
    patch.shipping_date = params.input.shippingDate;
  }
  if (params.input.currency) patch.currency = params.input.currency;
  if (params.input.useCollectiveContact !== undefined) {
    patch.use_collective_contact = params.input.useCollectiveContact;
  }
  if (params.input.contactId !== undefined) patch.contact_id = params.input.contactId;
  if (params.input.contactName !== undefined) {
    patch.contact_name = params.input.contactName;
  }
  if (
    params.input.contactId !== undefined ||
    params.input.lexofficeContactId !== undefined
  ) {
    patch.use_collective_contact = !(
      params.input.contactId || params.input.lexofficeContactId
    );
  }
  if (params.input.voucherNumber !== undefined) {
    patch.voucher_number = params.input.voucherNumber;
  }
  if (params.input.remark !== undefined) patch.remark = params.input.remark;
  if (params.input.status) patch.status = params.input.status;

  const { data, error } = await sb
    .from("accounting_vouchers")
    .update(patch)
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.voucherId)
    .select("*")
    .single();

  if (error) return { row: null, error: error.message };
  return { row: mapVoucherRow(data as Record<string, unknown>), error: null };
}

export async function deleteAccountingVoucher(
  sb: SupabaseClient,
  restaurantId: string,
  voucherId: string,
): Promise<{ error: string | null }> {
  const existing = await getAccountingVoucher(sb, restaurantId, voucherId);
  if (!existing) return { error: "Beleg nicht gefunden." };
  if (existing.source === "lexoffice") {
    return {
      error: "Lexware-Belege können nur in Lexware gelöscht werden.",
    };
  }

  const { error } = await sb
    .from("accounting_vouchers")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", voucherId);

  if (error) return { error: error.message };

  if (existing.storage_path) {
    const admin = createSupabaseAdminClient();
    await admin?.storage
      .from(ACCOUNTING_VOUCHERS_STORAGE_BUCKET)
      .remove([existing.storage_path]);
  }

  return { error: null };
}

export async function attachAccountingVoucherFile(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    voucherId: string;
    userId: string;
    file: { buffer: Buffer; fileName: string; mimeType: string; sizeBytes: number };
  },
): Promise<{ row: AccountingVoucherRow | null; error: string | null }> {
  const existing = await getAccountingVoucher(
    sb,
    params.restaurantId,
    params.voucherId,
  );
  if (!existing) return { row: null, error: "Beleg nicht gefunden." };
  if (existing.source === "lexoffice") {
    return {
      row: null,
      error: "Anhang für Lexware-Belege bitte in Lexware pflegen.",
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { row: null, error: "Storage nicht verfügbar." };

  const storagePath = buildAccountingVoucherStoragePath({
    restaurantId: params.restaurantId,
    voucherId: params.voucherId,
    fileName: params.file.fileName,
  });

  if (existing.storage_path) {
    await admin.storage
      .from(ACCOUNTING_VOUCHERS_STORAGE_BUCKET)
      .remove([existing.storage_path]);
  }

  const { error: uploadError } = await admin.storage
    .from(ACCOUNTING_VOUCHERS_STORAGE_BUCKET)
    .upload(storagePath, params.file.buffer, {
      contentType: params.file.mimeType,
      upsert: true,
    });
  if (uploadError) return { row: null, error: uploadError.message };

  const { data, error } = await sb
    .from("accounting_vouchers")
    .update({
      storage_path: storagePath,
      file_name: params.file.fileName,
      mime_type: params.file.mimeType,
      size_bytes: params.file.sizeBytes,
      updated_by: params.userId,
    })
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.voucherId)
    .select("*")
    .single();

  if (error) return { row: null, error: error.message };
  return { row: mapVoucherRow(data as Record<string, unknown>), error: null };
}
