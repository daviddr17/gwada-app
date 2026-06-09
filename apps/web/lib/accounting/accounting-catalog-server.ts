import "server-only";

import {
  DEFAULT_ACCOUNTING_TAX_RATES,
  DEFAULT_ACCOUNTING_UNITS,
} from "@/lib/accounting/default-catalog";
import type {
  AccountingArticleRow,
  AccountingTaxRateRow,
  AccountingUnitRow,
} from "@/lib/types/accounting";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureAccountingCatalogDefaults(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  const { count: taxCount } = await sb
    .from("accounting_tax_rates")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  if (!taxCount) {
    await sb.from("accounting_tax_rates").insert(
      DEFAULT_ACCOUNTING_TAX_RATES.map((row) => ({
        restaurant_id: restaurantId,
        ...row,
      })),
    );
  }

  const { count: unitCount } = await sb
    .from("accounting_units")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId);

  if (!unitCount) {
    await sb.from("accounting_units").insert(
      DEFAULT_ACCOUNTING_UNITS.map((name, index) => ({
        restaurant_id: restaurantId,
        name,
        sort_order: index,
      })),
    );
  }
}

export async function listAccountingTaxRates(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<AccountingTaxRateRow[]> {
  await ensureAccountingCatalogDefaults(sb, restaurantId);
  const { data } = await sb
    .from("accounting_tax_rates")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("archived", false)
    .order("sort_order", { ascending: true });
  return (data ?? []) as AccountingTaxRateRow[];
}

export async function listAccountingUnits(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<AccountingUnitRow[]> {
  await ensureAccountingCatalogDefaults(sb, restaurantId);
  const { data } = await sb
    .from("accounting_units")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("archived", false)
    .order("sort_order", { ascending: true });
  return (data ?? []) as AccountingUnitRow[];
}

export async function listAccountingArticles(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<AccountingArticleRow[]> {
  const { data } = await sb
    .from("accounting_articles")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("archived", false)
    .order("name", { ascending: true });
  return (data ?? []) as AccountingArticleRow[];
}

export async function upsertAccountingTaxRate(
  sb: SupabaseClient,
  restaurantId: string,
  payload: {
    id?: string;
    label: string;
    rate_percent: number;
    is_default?: boolean;
    sort_order?: number;
    archived?: boolean;
  },
): Promise<{ row: AccountingTaxRateRow | null; error: string | null }> {
  if (payload.is_default) {
    await sb
      .from("accounting_tax_rates")
      .update({ is_default: false })
      .eq("restaurant_id", restaurantId);
  }
  if (payload.id) {
    const { data, error } = await sb
      .from("accounting_tax_rates")
      .update({
        label: payload.label,
        rate_percent: payload.rate_percent,
        is_default: payload.is_default ?? false,
        sort_order: payload.sort_order,
        archived: payload.archived ?? false,
      })
      .eq("restaurant_id", restaurantId)
      .eq("id", payload.id)
      .select("*")
      .single();
    return { row: (data as AccountingTaxRateRow) ?? null, error: error?.message ?? null };
  }
  const { data, error } = await sb
    .from("accounting_tax_rates")
    .insert({
      restaurant_id: restaurantId,
      label: payload.label,
      rate_percent: payload.rate_percent,
      is_default: payload.is_default ?? false,
      sort_order: payload.sort_order ?? 0,
    })
    .select("*")
    .single();
  return { row: (data as AccountingTaxRateRow) ?? null, error: error?.message ?? null };
}

export async function reorderAccountingTaxRates(
  sb: SupabaseClient,
  restaurantId: string,
  orderedIds: string[],
): Promise<{ error: string | null }> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await sb
      .from("accounting_tax_rates")
      .update({ sort_order: i })
      .eq("restaurant_id", restaurantId)
      .eq("id", orderedIds[i]);
    if (error) return { error: error.message };
  }
  return { error: null };
}

export async function upsertAccountingUnit(
  sb: SupabaseClient,
  restaurantId: string,
  payload: {
    id?: string;
    name: string;
    sort_order?: number;
    archived?: boolean;
  },
): Promise<{ row: AccountingUnitRow | null; error: string | null }> {
  if (payload.id) {
    const { data, error } = await sb
      .from("accounting_units")
      .update({
        name: payload.name,
        sort_order: payload.sort_order,
        archived: payload.archived ?? false,
      })
      .eq("restaurant_id", restaurantId)
      .eq("id", payload.id)
      .select("*")
      .single();
    return { row: (data as AccountingUnitRow) ?? null, error: error?.message ?? null };
  }
  const { data, error } = await sb
    .from("accounting_units")
    .insert({
      restaurant_id: restaurantId,
      name: payload.name,
      sort_order: payload.sort_order ?? 0,
    })
    .select("*")
    .single();
  return { row: (data as AccountingUnitRow) ?? null, error: error?.message ?? null };
}

export async function reorderAccountingUnits(
  sb: SupabaseClient,
  restaurantId: string,
  orderedIds: string[],
): Promise<{ error: string | null }> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await sb
      .from("accounting_units")
      .update({ sort_order: i })
      .eq("restaurant_id", restaurantId)
      .eq("id", orderedIds[i]);
    if (error) return { error: error.message };
  }
  return { error: null };
}

export async function upsertAccountingArticle(
  sb: SupabaseClient,
  restaurantId: string,
  payload: {
    id?: string;
    name: string;
    description?: string | null;
    default_unit_name: string;
    default_unit_price: number;
    default_tax_rate_percent: number;
    currency?: string;
    archived?: boolean;
  },
): Promise<{ row: AccountingArticleRow | null; error: string | null }> {
  if (payload.id) {
    const { data, error } = await sb
      .from("accounting_articles")
      .update({
        name: payload.name,
        description: payload.description ?? null,
        default_unit_name: payload.default_unit_name,
        default_unit_price: payload.default_unit_price,
        default_tax_rate_percent: payload.default_tax_rate_percent,
        currency: payload.currency ?? "EUR",
        archived: payload.archived ?? false,
      })
      .eq("restaurant_id", restaurantId)
      .eq("id", payload.id)
      .select("*")
      .single();
    return { row: (data as AccountingArticleRow) ?? null, error: error?.message ?? null };
  }
  const { data, error } = await sb
    .from("accounting_articles")
    .insert({
      restaurant_id: restaurantId,
      name: payload.name,
      description: payload.description ?? null,
      default_unit_name: payload.default_unit_name,
      default_unit_price: payload.default_unit_price,
      default_tax_rate_percent: payload.default_tax_rate_percent,
      currency: payload.currency ?? "EUR",
    })
    .select("*")
    .single();
  return { row: (data as AccountingArticleRow) ?? null, error: error?.message ?? null };
}
