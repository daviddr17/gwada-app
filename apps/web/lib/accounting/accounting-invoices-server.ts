import "server-only";

import {
  computeDocumentTotals,
  reindexLineItems,
} from "@/lib/accounting/compute-line-totals";
import {
  buildVoucherPeriodIntroduction,
  resolveStoredVoucherDate,
} from "@/lib/accounting/accounting-voucher-date";
import { resolveAccountingSalesProvider } from "@/lib/accounting/providers/resolve-provider";
import { applyInvoiceInventoryDeduction } from "@/lib/accounting/apply-invoice-inventory-deduction";
import type {
  AccountingInvoiceRow,
  AccountingSalesDocumentInput,
} from "@/lib/types/accounting";
import type { SupabaseClient } from "@supabase/supabase-js";

function mapInvoiceRow(data: Record<string, unknown>): AccountingInvoiceRow {
  return data as unknown as AccountingInvoiceRow;
}

export async function listAccountingInvoices(
  sb: SupabaseClient,
  restaurantId: string,
  source?: string | null,
): Promise<AccountingInvoiceRow[]> {
  let q = sb
    .from("accounting_invoices")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("voucher_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (source && source !== "all") {
    q = q.eq("source", source);
  }

  const { data, error } = await q;
  if (error) {
    console.warn("listAccountingInvoices", error.message);
    return [];
  }
  return (data ?? []).map((row) => mapInvoiceRow(row as Record<string, unknown>));
}

export async function getAccountingInvoice(
  sb: SupabaseClient,
  restaurantId: string,
  invoiceId: string,
): Promise<AccountingInvoiceRow | null> {
  const { data, error } = await sb
    .from("accounting_invoices")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !data) return null;
  return mapInvoiceRow(data as Record<string, unknown>);
}

export async function createAccountingInvoice(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    input: AccountingSalesDocumentInput;
  },
): Promise<{ row: AccountingInvoiceRow | null; error: string | null }> {
  const lineItems = reindexLineItems(params.input.lineItems);
  const totals = computeDocumentTotals(
    lineItems,
    params.input.taxMode,
    params.input.currency,
  );

  const syncToLexoffice = params.input.syncToLexoffice === true;
  const provider = resolveAccountingSalesProvider(syncToLexoffice);

  let external:
    | {
        source: string;
        externalId: string | null;
        externalVersion: number | null;
        externalEditUrl: string | null;
        voucherNumber: string | null;
        status: string;
      }
    | null = null;

  try {
    const created = await provider.createInvoice(params.restaurantId, {
      ...params.input,
      lineItems,
    });
    external = created;
  } catch (e) {
    return {
      row: null,
      error: e instanceof Error ? e.message : "Erstellen fehlgeschlagen.",
    };
  }

  const { data, error } = await sb
    .from("accounting_invoices")
    .insert({
      restaurant_id: params.restaurantId,
      source: external.source,
      external_id: external.externalId,
      external_version: external.externalVersion,
      external_edit_url: external.externalEditUrl,
      status: external.status,
      voucher_number: external.voucherNumber,
      voucher_date: resolveStoredVoucherDate({
        voucherDateKind: params.input.voucherDateKind ?? "date",
        voucherDate: params.input.voucherDate,
        voucherPeriodEnd: params.input.voucherPeriodEnd ?? null,
      }),
      voucher_date_kind: params.input.voucherDateKind ?? "date",
      voucher_period_start:
        params.input.voucherDateKind === "period"
          ? (params.input.voucherPeriodStart ?? null)
          : null,
      voucher_period_end:
        params.input.voucherDateKind === "period"
          ? (params.input.voucherPeriodEnd ?? null)
          : null,
      due_date: params.input.dueDate ?? null,
      delivery_date: params.input.deliveryDate ?? null,
      currency: params.input.currency,
      tax_mode: params.input.taxMode,
      recipient_type: params.input.recipientType,
      contact_id: params.input.contactId,
      recipient_snapshot: params.input.recipient,
      line_items: lineItems,
      totals,
      title: params.input.title ?? null,
      introduction:
        buildVoucherPeriodIntroduction({
          voucherDateKind: params.input.voucherDateKind ?? "date",
          voucherPeriodStart: params.input.voucherPeriodStart ?? null,
          voucherPeriodEnd: params.input.voucherPeriodEnd ?? null,
          introduction: params.input.introduction,
        }) ??
        params.input.introduction ??
        null,
      remark: params.input.remark ?? null,
      finalize_on_create: params.input.finalizeOnCreate ?? false,
      created_by: params.userId,
      updated_by: params.userId,
    })
    .select("*")
    .single();

  if (error) {
    return { row: null, error: error.message };
  }

  const row = mapInvoiceRow(data as Record<string, unknown>);
  const deductErr = await applyInvoiceInventoryDeduction(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    invoiceId: row.id,
    voucherNumber: row.voucher_number,
    lineItems: row.line_items,
  });
  if (deductErr.error) {
    console.warn("[gwada] applyInvoiceInventoryDeduction", deductErr.error);
  }

  return { row, error: null };
}

export async function updateAccountingInvoice(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    invoiceId: string;
    userId: string;
    input: Partial<AccountingSalesDocumentInput> & {
      status?: AccountingInvoiceRow["status"];
      acknowledgeSentEdit?: boolean;
    };
  },
): Promise<{ row: AccountingInvoiceRow | null; error: string | null }> {
  const existing = await getAccountingInvoice(
    sb,
    params.restaurantId,
    params.invoiceId,
  );
  if (!existing) return { row: null, error: "Rechnung nicht gefunden." };
  if (existing.source === "lexoffice") {
    return {
      row: null,
      error: "Lexware-Rechnungen können nur in Lexware bearbeitet werden.",
    };
  }

  const lineItems = params.input.lineItems
    ? reindexLineItems(params.input.lineItems)
    : existing.line_items;
  const taxMode = params.input.taxMode ?? existing.tax_mode;
  const currency = params.input.currency ?? existing.currency;
  const totals = computeDocumentTotals(lineItems, taxMode, currency);

  const patch: Record<string, unknown> = {
    line_items: lineItems,
    totals,
    tax_mode: taxMode,
    currency,
    updated_by: params.userId,
  };

  if (params.input.voucherDate) patch.voucher_date = params.input.voucherDate;
  if (params.input.voucherDateKind) {
    patch.voucher_date_kind = params.input.voucherDateKind;
    if (params.input.voucherDateKind === "period") {
      patch.voucher_period_start = params.input.voucherPeriodStart ?? null;
      patch.voucher_period_end = params.input.voucherPeriodEnd ?? null;
      if (params.input.voucherPeriodEnd) {
        patch.voucher_date = params.input.voucherPeriodEnd;
      }
    } else {
      patch.voucher_period_start = null;
      patch.voucher_period_end = null;
    }
  }
  if (params.input.dueDate !== undefined) patch.due_date = params.input.dueDate;
  if (params.input.deliveryDate !== undefined) {
    patch.delivery_date = params.input.deliveryDate;
  }
  if (params.input.recipientType) patch.recipient_type = params.input.recipientType;
  if (params.input.contactId !== undefined) patch.contact_id = params.input.contactId;
  if (params.input.recipient) patch.recipient_snapshot = params.input.recipient;
  if (params.input.title !== undefined) patch.title = params.input.title;
  if (params.input.introduction !== undefined) {
    patch.introduction = params.input.introduction;
  }
  if (params.input.remark !== undefined) patch.remark = params.input.remark;
  if (params.input.status) patch.status = params.input.status;

  const { data, error } = await sb
    .from("accounting_invoices")
    .update(patch)
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.invoiceId)
    .select("*")
    .single();

  if (error) return { row: null, error: error.message };
  return { row: mapInvoiceRow(data as Record<string, unknown>), error: null };
}
