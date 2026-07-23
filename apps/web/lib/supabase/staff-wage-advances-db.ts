import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { RestaurantStaffWageAdvanceRow } from "@/lib/types/staff";

function mapWageAdvanceRow(
  r: Record<string, unknown>,
): RestaurantStaffWageAdvanceRow {
  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    staff_id: r.staff_id as string,
    amount_cents: Number(r.amount_cents),
    paid_on: String(r.paid_on).slice(0, 10),
    note: (r.note as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

const WAGE_ADVANCE_SELECT =
  "id, restaurant_id, staff_id, amount_cents, paid_on, note, created_at, updated_at";

export async function fetchStaffWageAdvancesInRange(
  restaurantId: string,
  staffId: string,
  paidOnFromYmd: string,
  paidOnToYmd: string,
): Promise<{ data: RestaurantStaffWageAdvanceRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff_wage_advances")
    .select(WAGE_ADVANCE_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("staff_id", staffId)
    .gte("paid_on", paidOnFromYmd)
    .lte("paid_on", paidOnToYmd)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) =>
      mapWageAdvanceRow(r as Record<string, unknown>),
    ),
    error: null,
  };
}

export async function upsertStaffWageAdvance(params: {
  restaurantId: string;
  staffId: string;
  amountCents: number;
  paidOn: string;
  note: string | null;
  id?: string;
}): Promise<{ id: string } | null> {
  const supabase = createSupabaseBrowserClient();
  const row = {
    restaurant_id: params.restaurantId,
    staff_id: params.staffId,
    amount_cents: params.amountCents,
    paid_on: params.paidOn,
    note: params.note,
  };

  if (params.id) {
    const { error } = await supabase
      .from("restaurant_staff_wage_advances")
      .update(row)
      .eq("id", params.id)
      .eq("restaurant_id", params.restaurantId);
    return error ? null : { id: params.id };
  }

  const { data, error } = await supabase
    .from("restaurant_staff_wage_advances")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: data.id as string };
}

export async function deleteStaffWageAdvance(
  restaurantId: string,
  id: string,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_staff_wage_advances")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", restaurantId);
  return !error;
}
