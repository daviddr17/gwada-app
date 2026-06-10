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
import type {
  AccountingQuotationRow,
  AccountingSalesDocumentInput,
} from "@/lib/types/accounting";
import type { SupabaseClient } from "@supabase/supabase-js";

function mapQuotationRow(data: Record<string, unknown>): AccountingQuotationRow {
  return data as unknown as AccountingQuotationRow;
}

export async function listAccountingQuotations(
  sb: SupabaseClient,
  restaurantId: string,
  source?: string | null,
): Promise<AccountingQuotationRow[]> {
  let q = sb
    .from("accounting_quotations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("voucher_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (source && source !== "all") {
    q = q.eq("source", source);
  }

  const { data, error } = await q;
  if (error) {
    console.warn("listAccountingQuotations", error.message);
    return [];
  }
  return (data ?? []).map((row) => mapQuotationRow(row as Record<string, unknown>));
}

export async function getAccountingQuotation(
  sb: SupabaseClient,
  restaurantId: string,
  quotationId: string,
): Promise<AccountingQuotationRow | null> {
  const { data, error } = await sb
    .from("accounting_quotations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", quotationId)
    .maybeSingle();

  if (error || !data) return null;
  return mapQuotationRow(data as Record<string, unknown>);
}

export async function createAccountingQuotation(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    input: AccountingSalesDocumentInput;
  },
): Promise<{ row: AccountingQuotationRow | null; error: string | null }> {
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
    const created = await provider.createQuotation(params.restaurantId, {
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
    .from("accounting_quotations")
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
      expiration_date: params.input.expirationDate ?? params.input.dueDate ?? null,
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
  return { row: mapQuotationRow(data as Record<string, unknown>), error: null };
}

export async function updateAccountingQuotation(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    quotationId: string;
    userId: string;
    input: Partial<AccountingSalesDocumentInput> & {
      status?: AccountingQuotationRow["status"];
    };
  },
): Promise<{ row: AccountingQuotationRow | null; error: string | null }> {
  const { data: existingData, error: loadErr } = await sb
    .from("accounting_quotations")
    .select("*")
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.quotationId)
    .maybeSingle();

  if (loadErr || !existingData) {
    return { row: null, error: "Angebot nicht gefunden." };
  }
  const existing = mapQuotationRow(existingData as Record<string, unknown>);
  if (existing.source === "lexoffice") {
    return {
      row: null,
      error: "Lexware-Angebote können nur in Lexware bearbeitet werden.",
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
  if (params.input.expirationDate !== undefined) {
    patch.expiration_date = params.input.expirationDate;
  } else if (params.input.dueDate !== undefined) {
    patch.expiration_date = params.input.dueDate;
  }
  if (params.input.deliveryDate !== undefined) {
    patch.delivery_date = params.input.deliveryDate;
  }
  if (params.input.recipientType) patch.recipient_type = params.input.recipientType;
  if (params.input.contactId !== undefined) patch.contact_id = params.input.contactId;
  if (params.input.recipient) patch.recipient_snapshot = params.input.recipient;
  if (params.input.status) patch.status = params.input.status;

  const { data, error } = await sb
    .from("accounting_quotations")
    .update(patch)
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.quotationId)
    .select("*")
    .single();

  if (error) return { row: null, error: error.message };
  return { row: mapQuotationRow(data as Record<string, unknown>), error: null };
}
