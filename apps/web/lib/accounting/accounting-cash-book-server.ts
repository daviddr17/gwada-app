import "server-only";

import {
  cashEntryTaxLinesFromDb,
  normalizeCashEntryTaxLines,
} from "@/lib/accounting/accounting-cash-display";
import { DEFAULT_ACCOUNTING_CASH_CATEGORIES } from "@/lib/accounting/accounting-cash-book-defaults";
import {
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import type {
  AccountingCashBookListResult,
  AccountingCashBookSettingsRow,
  AccountingCashBookSummary,
  AccountingCashCategoryRow,
  AccountingCashDirection,
  AccountingCashEntryInput,
  AccountingCashEntryRow,
} from "@/lib/types/accounting-cash-book";
import type { SupabaseClient } from "@supabase/supabase-js";

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

type DbCashEntryRow = Record<string, unknown> & {
  accounting_cash_categories?: { name: string } | null;
  accounting_vouchers?: {
    voucher_number: string | null;
    contact_name: string | null;
  } | null;
  accounting_cash_entry_tax_lines?: Array<{
    id: string;
    sort_order: number;
    amount: unknown;
    tax_rate_percent: unknown;
    tax_amount: unknown;
  }> | null;
};

function mapCashEntryRow(row: DbCashEntryRow): AccountingCashEntryRow {
  const {
    accounting_cash_categories: category,
    accounting_vouchers: voucher,
    accounting_cash_entry_tax_lines: taxLineRows,
    ...rest
  } = row;

  const tax_lines = cashEntryTaxLinesFromDb(taxLineRows ?? []);

  return {
    ...(rest as AccountingCashEntryRow),
    amount: num(rest.amount),
    tax_rate_percent: num(rest.tax_rate_percent),
    voucher_id: (rest.voucher_id as string | null) ?? null,
    category_name: category?.name ?? undefined,
    voucher_number: voucher?.voucher_number ?? null,
    voucher_contact_name: voucher?.contact_name ?? null,
    tax_lines,
  };
}

async function validateCashEntryVoucher(
  sb: SupabaseClient,
  restaurantId: string,
  voucherId: string | null | undefined,
): Promise<boolean> {
  if (!voucherId) return true;
  const { data } = await sb
    .from("accounting_vouchers")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("id", voucherId)
    .maybeSingle();
  return Boolean(data);
}

async function replaceCashEntryTaxLines(
  sb: SupabaseClient,
  entryId: string,
  lines: ReturnType<typeof normalizeCashEntryTaxLines>,
): Promise<{ error?: string }> {
  const { error: deleteError } = await sb
    .from("accounting_cash_entry_tax_lines")
    .delete()
    .eq("entry_id", entryId);
  if (deleteError) return { error: deleteError.message };

  if (lines.length === 0) return { error: "invalid_tax_lines" };

  const { error: insertError } = await sb
    .from("accounting_cash_entry_tax_lines")
    .insert(
      lines.map((line, index) => ({
        entry_id: entryId,
        sort_order: index,
        amount: line.amount,
        tax_rate_percent: line.tax_rate_percent,
        tax_amount: line.tax_amount,
      })),
    );
  if (insertError) return { error: insertError.message };
  return {};
}

const CASH_ENTRY_SELECT =
  "*, accounting_cash_categories!inner(name), accounting_vouchers(voucher_number, contact_name), accounting_cash_entry_tax_lines(id, sort_order, amount, tax_rate_percent, tax_amount)";

export async function ensureAccountingCashBookDefaults(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  const { count: categoryCount } = await sb
    .from("accounting_cash_categories")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  if (!categoryCount) {
    await sb.from("accounting_cash_categories").insert(
      DEFAULT_ACCOUNTING_CASH_CATEGORIES.map((row) => ({
        restaurant_id: restaurantId,
        ...row,
      })),
    );
  } else {
    const { data: existingCats } = await sb
      .from("accounting_cash_categories")
      .select("name, direction")
      .eq("restaurant_id", restaurantId);
    const have = new Set(
      (existingCats ?? []).map(
        (row) =>
          `${String(row.direction).toLowerCase()}:${String(row.name).toLowerCase()}`,
      ),
    );
    const missing = DEFAULT_ACCOUNTING_CASH_CATEGORIES.filter(
      (row) =>
        !have.has(`${row.direction.toLowerCase()}:${row.name.toLowerCase()}`),
    );
    if (missing.length > 0) {
      await sb.from("accounting_cash_categories").insert(
        missing.map((row) => ({
          restaurant_id: restaurantId,
          ...row,
        })),
      );
    }
  }

  const { data: settings } = await sb
    .from("accounting_cash_book_settings")
    .select("restaurant_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (!settings) {
    await sb.from("accounting_cash_book_settings").insert({
      restaurant_id: restaurantId,
      opening_balance: 0,
    });
  }
}

export async function getAccountingCashBookSettings(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<AccountingCashBookSettingsRow> {
  await ensureAccountingCashBookDefaults(sb, restaurantId);
  const { data } = await sb
    .from("accounting_cash_book_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .single();
  return {
    ...(data as AccountingCashBookSettingsRow),
    opening_balance: num(data?.opening_balance),
  };
}

export async function updateAccountingCashBookOpeningBalance(
  sb: SupabaseClient,
  restaurantId: string,
  openingBalance: number,
): Promise<{ row: AccountingCashBookSettingsRow | null; error?: string }> {
  await ensureAccountingCashBookDefaults(sb, restaurantId);
  const { data, error } = await sb
    .from("accounting_cash_book_settings")
    .upsert({
      restaurant_id: restaurantId,
      opening_balance: openingBalance,
    })
    .select("*")
    .single();

  if (error) return { row: null, error: error.message };
  return {
    row: {
      ...(data as AccountingCashBookSettingsRow),
      opening_balance: num(data.opening_balance),
    },
  };
}

export async function listAccountingCashCategories(
  sb: SupabaseClient,
  restaurantId: string,
  direction?: AccountingCashDirection,
  includeArchived = false,
): Promise<AccountingCashCategoryRow[]> {
  await ensureAccountingCashBookDefaults(sb, restaurantId);
  let query = sb
    .from("accounting_cash_categories")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  if (direction) query = query.eq("direction", direction);
  if (!includeArchived) query = query.eq("archived", false);

  const { data } = await query;
  return (data ?? []) as AccountingCashCategoryRow[];
}

export async function upsertAccountingCashCategory(
  sb: SupabaseClient,
  restaurantId: string,
  payload: {
    id?: string;
    direction: AccountingCashDirection;
    name: string;
    archived?: boolean;
    sort_order?: number;
  },
): Promise<{ row: AccountingCashCategoryRow | null; error?: string }> {
  await ensureAccountingCashBookDefaults(sb, restaurantId);
  const name = payload.name.trim();
  if (!name) return { row: null, error: "invalid_name" };

  if (payload.id) {
    const { data, error } = await sb
      .from("accounting_cash_categories")
      .update({
        name,
        archived: payload.archived ?? false,
      })
      .eq("restaurant_id", restaurantId)
      .eq("id", payload.id)
      .select("*")
      .single();
    if (error) return { row: null, error: error.message };
    return { row: data as AccountingCashCategoryRow };
  }

  const { count } = await sb
    .from("accounting_cash_categories")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("direction", payload.direction);

  const { data, error } = await sb
    .from("accounting_cash_categories")
    .insert({
      restaurant_id: restaurantId,
      direction: payload.direction,
      name,
      sort_order: payload.sort_order ?? (count ?? 0),
    })
    .select("*")
    .single();

  if (error) return { row: null, error: error.message };
  return { row: data as AccountingCashCategoryRow };
}

export async function reorderAccountingCashCategories(
  sb: SupabaseClient,
  restaurantId: string,
  direction: AccountingCashDirection,
  orderedIds: string[],
): Promise<{ error?: string }> {
  for (let i = 0; i < orderedIds.length; i += 1) {
    const { error } = await sb
      .from("accounting_cash_categories")
      .update({ sort_order: i })
      .eq("restaurant_id", restaurantId)
      .eq("direction", direction)
      .eq("id", orderedIds[i]!);
    if (error) return { error: error.message };
  }
  return {};
}

export async function deleteAccountingCashCategory(
  sb: SupabaseClient,
  restaurantId: string,
  categoryId: string,
): Promise<{ error?: string }> {
  const { count } = await sb
    .from("accounting_cash_entries")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("category_id", categoryId);

  if (count && count > 0) {
    return { error: "category_in_use" };
  }

  const { error } = await sb
    .from("accounting_cash_categories")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", categoryId);

  if (error) return { error: error.message };
  return {};
}

async function computeCashBookSummary(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<AccountingCashBookSummary> {
  const settings = await getAccountingCashBookSettings(sb, restaurantId);
  const { data } = await sb
    .from("accounting_cash_entries")
    .select("direction, amount")
    .eq("restaurant_id", restaurantId);

  let totalIncome = 0;
  let totalExpense = 0;
  for (const row of data ?? []) {
    const amount = num(row.amount);
    if (row.direction === "income") totalIncome += amount;
    else totalExpense += amount;
  }

  return {
    openingBalance: settings.opening_balance,
    totalIncome,
    totalExpense,
    currentBalance: settings.opening_balance + totalIncome - totalExpense,
  };
}

export async function getAccountingCashEntry(
  sb: SupabaseClient,
  restaurantId: string,
  entryId: string,
): Promise<AccountingCashEntryRow | null> {
  await ensureAccountingCashBookDefaults(sb, restaurantId);
  const { data } = await sb
    .from("accounting_cash_entries")
    .select(CASH_ENTRY_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("id", entryId)
    .maybeSingle();

  if (!data) return null;
  return mapCashEntryRow(data as DbCashEntryRow);
}

export async function listAccountingCashEntries(
  sb: SupabaseClient,
  restaurantId: string,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    direction?: AccountingCashDirection | "all";
  } = {},
): Promise<AccountingCashBookListResult> {
  await ensureAccountingCashBookDefaults(sb, restaurantId);

  const pageSize = params.pageSize ?? LIST_PAGE_SIZE_DEFAULT;
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = sb
    .from("accounting_cash_entries")
    .select(CASH_ENTRY_SELECT, { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params.direction && params.direction !== "all") {
    query = query.eq("direction", params.direction);
  }

  const search = params.search?.trim();
  if (search) {
    const escaped = search.replace(/[%_]/g, "");
    query = query.ilike("note", `%${escaped}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const totalCount = count ?? 0;
  const summary = await computeCashBookSummary(sb, restaurantId);

  const entries = (data ?? []).map((row) =>
    mapCashEntryRow(row as DbCashEntryRow),
  );

  return {
    entries,
    summary,
    page,
    pageSize,
    totalCount,
    totalPages: totalPagesFromCount(totalCount, pageSize),
  };
}

async function validateCashEntryCategory(
  sb: SupabaseClient,
  restaurantId: string,
  categoryId: string,
  direction: AccountingCashDirection,
): Promise<boolean> {
  const { data } = await sb
    .from("accounting_cash_categories")
    .select("id, direction, archived")
    .eq("restaurant_id", restaurantId)
    .eq("id", categoryId)
    .maybeSingle();

  return Boolean(data && !data.archived && data.direction === direction);
}

export async function upsertAccountingCashEntry(
  sb: SupabaseClient,
  restaurantId: string,
  payload: AccountingCashEntryInput,
): Promise<{ row: AccountingCashEntryRow | null; error?: string }> {
  await ensureAccountingCashBookDefaults(sb, restaurantId);

  const normalizedLines = normalizeCashEntryTaxLines(payload.tax_lines ?? []);
  if (normalizedLines.length === 0) {
    return { row: null, error: "invalid_tax_lines" };
  }

  const amount = Math.round(
    normalizedLines.reduce((sum, line) => sum + line.amount, 0) * 100,
  ) / 100;
  if (amount <= 0) return { row: null, error: "invalid_amount" };

  const validCategory = await validateCashEntryCategory(
    sb,
    restaurantId,
    payload.category_id,
    payload.direction,
  );
  if (!validCategory) return { row: null, error: "invalid_category" };

  const voucherId = payload.voucher_id?.trim() || null;
  const validVoucher = await validateCashEntryVoucher(
    sb,
    restaurantId,
    voucherId,
  );
  if (!validVoucher) return { row: null, error: "invalid_voucher" };

  const primaryTaxRate =
    normalizedLines.length === 1 ? normalizedLines[0]!.tax_rate_percent : 0;

  const rowPayload = {
    entry_date: payload.entry_date,
    direction: payload.direction,
    category_id: payload.category_id,
    amount,
    tax_rate_percent: primaryTaxRate,
    note: payload.note?.trim() || null,
    voucher_id: voucherId,
  };

  if (payload.id) {
    const { data, error } = await sb
      .from("accounting_cash_entries")
      .update(rowPayload)
      .eq("restaurant_id", restaurantId)
      .eq("id", payload.id)
      .select("id")
      .single();
    if (error || !data) return { row: null, error: error?.message ?? "update_failed" };

    const linesResult = await replaceCashEntryTaxLines(
      sb,
      payload.id,
      normalizedLines,
    );
    if (linesResult.error) return { row: null, error: linesResult.error };

    const row = await getAccountingCashEntry(sb, restaurantId, payload.id);
    return { row };
  }

  const { data, error } = await sb
    .from("accounting_cash_entries")
    .insert({ restaurant_id: restaurantId, ...rowPayload })
    .select("id")
    .single();

  if (error || !data) return { row: null, error: error?.message ?? "create_failed" };

  const linesResult = await replaceCashEntryTaxLines(
    sb,
    data.id,
    normalizedLines,
  );
  if (linesResult.error) {
    await sb.from("accounting_cash_entries").delete().eq("id", data.id);
    return { row: null, error: linesResult.error };
  }

  const row = await getAccountingCashEntry(sb, restaurantId, data.id);
  return { row };
}

export async function deleteAccountingCashEntry(
  sb: SupabaseClient,
  restaurantId: string,
  entryId: string,
): Promise<{ error?: string }> {
  const { error } = await sb
    .from("accounting_cash_entries")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", entryId);

  if (error) return { error: error.message };
  return {};
}
