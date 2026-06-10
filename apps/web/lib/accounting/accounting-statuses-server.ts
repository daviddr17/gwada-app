import "server-only";

import {
  DEFAULT_ACCOUNTING_DOCUMENT_STATUSES,
  type AccountingDocumentKind,
} from "@/lib/accounting/default-catalog";
import { normalizeRestaurantPositionColor } from "@/lib/restaurant/restaurant-position-colors";
import type { AccountingDocumentStatusRow } from "@/lib/types/accounting";
import type { SupabaseClient } from "@supabase/supabase-js";

function slugifyStatusCode(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  if (!base) return "status";
  return /^[a-z]/.test(base) ? base : `s_${base}`.slice(0, 40);
}

async function uniqueStatusCode(
  sb: SupabaseClient,
  restaurantId: string,
  documentKind: AccountingDocumentKind,
  preferred: string,
): Promise<string> {
  let code = preferred;
  let suffix = 1;
  for (;;) {
    const { count } = await sb
      .from("accounting_document_statuses")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("document_kind", documentKind)
      .eq("code", code);
    if (!count) return code;
    code = `${preferred}_${suffix}`.slice(0, 40);
    suffix += 1;
  }
}

export async function ensureAccountingDocumentStatusDefaults(
  sb: SupabaseClient,
  restaurantId: string,
  documentKind: AccountingDocumentKind,
): Promise<void> {
  const { count } = await sb
    .from("accounting_document_statuses")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("document_kind", documentKind);

  if (count) return;

  await sb.from("accounting_document_statuses").insert(
    DEFAULT_ACCOUNTING_DOCUMENT_STATUSES[documentKind].map((row) => ({
      restaurant_id: restaurantId,
      document_kind: documentKind,
      ...row,
    })),
  );
}

export async function listAccountingDocumentStatuses(
  sb: SupabaseClient,
  restaurantId: string,
  documentKind: AccountingDocumentKind,
  options?: { includeArchived?: boolean },
): Promise<AccountingDocumentStatusRow[]> {
  await ensureAccountingDocumentStatusDefaults(sb, restaurantId, documentKind);
  let query = sb
    .from("accounting_document_statuses")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("document_kind", documentKind)
    .order("sort_order", { ascending: true });

  if (!options?.includeArchived) {
    query = query.eq("archived", false);
  }

  const { data } = await query;
  return (data ?? []) as AccountingDocumentStatusRow[];
}

export async function listAllAccountingDocumentStatuses(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<AccountingDocumentStatusRow[]> {
  const kinds: AccountingDocumentKind[] = ["invoice", "quotation", "voucher"];
  await Promise.all(
    kinds.map((kind) => ensureAccountingDocumentStatusDefaults(sb, restaurantId, kind)),
  );
  const { data } = await sb
    .from("accounting_document_statuses")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("document_kind", { ascending: true })
    .order("sort_order", { ascending: true });
  return (data ?? []) as AccountingDocumentStatusRow[];
}

async function countStatusUsage(
  sb: SupabaseClient,
  restaurantId: string,
  documentKind: AccountingDocumentKind,
  code: string,
): Promise<number> {
  const table =
    documentKind === "invoice"
      ? "accounting_invoices"
      : documentKind === "quotation"
        ? "accounting_quotations"
        : "accounting_vouchers";
  const { count } = await sb
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("status", code);
  return count ?? 0;
}

export async function upsertAccountingDocumentStatus(
  sb: SupabaseClient,
  restaurantId: string,
  documentKind: AccountingDocumentKind,
  payload: {
    id?: string;
    label: string;
    color_hex?: string;
    sort_order?: number;
    archived?: boolean;
  },
): Promise<{ row: AccountingDocumentStatusRow | null; error: string | null }> {
  const label = payload.label.trim();
  if (!label) return { row: null, error: "label_required" };

  if (payload.id) {
    const { data: existing } = await sb
      .from("accounting_document_statuses")
      .select("is_system, code")
      .eq("restaurant_id", restaurantId)
      .eq("document_kind", documentKind)
      .eq("id", payload.id)
      .maybeSingle();

    if (!existing) return { row: null, error: "not_found" };

    const code = existing.code as string;
    const colorHex = normalizeRestaurantPositionColor(
      payload.color_hex,
      code,
    );

    const { data, error } = await sb
      .from("accounting_document_statuses")
      .update({
        label,
        color_hex: colorHex,
        sort_order: payload.sort_order,
        archived: payload.archived ?? false,
      })
      .eq("restaurant_id", restaurantId)
      .eq("document_kind", documentKind)
      .eq("id", payload.id)
      .select("*")
      .single();

    return {
      row: (data as AccountingDocumentStatusRow) ?? null,
      error: error?.message ?? null,
    };
  }

  const preferred = slugifyStatusCode(label);
  const code = await uniqueStatusCode(sb, restaurantId, documentKind, preferred);
  const colorHex = normalizeRestaurantPositionColor(payload.color_hex, code);
  const { count } = await sb
    .from("accounting_document_statuses")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("document_kind", documentKind);

  const { data, error } = await sb
    .from("accounting_document_statuses")
    .insert({
      restaurant_id: restaurantId,
      document_kind: documentKind,
      code,
      label,
      color_hex: colorHex,
      sort_order: payload.sort_order ?? (count ?? 0),
      is_system: false,
    })
    .select("*")
    .single();

  return {
    row: (data as AccountingDocumentStatusRow) ?? null,
    error: error?.message ?? null,
  };
}

export async function reorderAccountingDocumentStatuses(
  sb: SupabaseClient,
  restaurantId: string,
  documentKind: AccountingDocumentKind,
  orderedIds: string[],
): Promise<{ error: string | null }> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await sb
      .from("accounting_document_statuses")
      .update({ sort_order: i })
      .eq("restaurant_id", restaurantId)
      .eq("document_kind", documentKind)
      .eq("id", orderedIds[i]);
    if (error) return { error: error.message };
  }
  return { error: null };
}

export async function deleteAccountingDocumentStatus(
  sb: SupabaseClient,
  restaurantId: string,
  documentKind: AccountingDocumentKind,
  id: string,
): Promise<{ error: string | null }> {
  const { data: row } = await sb
    .from("accounting_document_statuses")
    .select("code, is_system")
    .eq("restaurant_id", restaurantId)
    .eq("document_kind", documentKind)
    .eq("id", id)
    .maybeSingle();

  if (!row) return { error: "not_found" };
  if (row.is_system) return { error: "system_status_not_deletable" };

  const usage = await countStatusUsage(
    sb,
    restaurantId,
    documentKind,
    row.code as string,
  );
  if (usage > 0) return { error: "status_in_use" };

  const { error } = await sb
    .from("accounting_document_statuses")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("document_kind", documentKind)
    .eq("id", id);

  return { error: error?.message ?? null };
}
