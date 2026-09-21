import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  RestaurantStaffPayrollSettlementRow,
  StaffPayrollSettlementStatus,
} from "@/lib/types/staff";

function mapSettlementRow(
  r: Record<string, unknown>,
): RestaurantStaffPayrollSettlementRow {
  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    staff_id: r.staff_id as string,
    period_year: Number(r.period_year),
    period_month: Number(r.period_month),
    status: r.status as StaffPayrollSettlementStatus,
    amount_cents: Number(r.amount_cents),
    note: (r.note as string | null) ?? null,
    paid_at: (r.paid_at as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

const SETTLEMENT_SELECT =
  "id, restaurant_id, staff_id, period_year, period_month, status, amount_cents, note, paid_at, created_at, updated_at";

export async function fetchStaffPayrollSettlementsForMonth(
  restaurantId: string,
  periodYear: number,
  periodMonth: number,
  staffId?: string | null,
): Promise<{
  data: RestaurantStaffPayrollSettlementRow[];
  error: string | null;
}> {
  const supabase = createSupabaseBrowserClient();
  let q = supabase
    .from("restaurant_staff_payroll_settlements")
    .select(SETTLEMENT_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("period_year", periodYear)
    .eq("period_month", periodMonth);
  if (staffId) q = q.eq("staff_id", staffId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) =>
      mapSettlementRow(r as Record<string, unknown>),
    ),
    error: null,
  };
}

/** Settlements whose calendar month overlaps [fromYmd, toYmd] (inclusive). */
export async function fetchStaffPayrollSettlementsOverlappingRange(
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
  staffId?: string | null,
): Promise<{
  data: RestaurantStaffPayrollSettlementRow[];
  error: string | null;
}> {
  const fromYear = Number(fromYmd.slice(0, 4));
  const fromMonth = Number(fromYmd.slice(5, 7));
  const toYear = Number(toYmd.slice(0, 4));
  const toMonth = Number(toYmd.slice(5, 7));
  if (
    !fromYear ||
    !fromMonth ||
    !toYear ||
    !toMonth ||
    fromYmd > toYmd
  ) {
    return { data: [], error: null };
  }

  const supabase = createSupabaseBrowserClient();
  let q = supabase
    .from("restaurant_staff_payroll_settlements")
    .select(SETTLEMENT_SELECT)
    .eq("restaurant_id", restaurantId)
    .gte("period_year", fromYear)
    .lte("period_year", toYear);
  if (staffId) q = q.eq("staff_id", staffId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };

  const rows = (data ?? [])
    .map((r) => mapSettlementRow(r as Record<string, unknown>))
    .filter((row) => {
      const key = row.period_year * 100 + row.period_month;
      const fromKey = fromYear * 100 + fromMonth;
      const toKey = toYear * 100 + toMonth;
      return key >= fromKey && key <= toKey;
    });
  return { data: rows, error: null };
}

export async function upsertStaffPayrollSettlement(params: {
  restaurantId: string;
  staffId: string;
  periodYear: number;
  periodMonth: number;
  status: StaffPayrollSettlementStatus;
  amountCents: number;
  note?: string | null;
  paidAt?: string | null;
}): Promise<{ data: RestaurantStaffPayrollSettlementRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    restaurant_id: params.restaurantId,
    staff_id: params.staffId,
    period_year: params.periodYear,
    period_month: params.periodMonth,
    status: params.status,
    amount_cents: Math.max(0, Math.round(params.amountCents)),
    note: params.note ?? null,
    paid_at:
      params.status === "open"
        ? null
        : (params.paidAt ?? new Date().toISOString()),
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("restaurant_staff_payroll_settlements")
    .upsert(payload, {
      onConflict: "restaurant_id,staff_id,period_year,period_month",
    })
    .select(SETTLEMENT_SELECT)
    .single();

  if (error || !data) {
    return { data: null, error: error?.message ?? "Speichern fehlgeschlagen." };
  }
  return {
    data: mapSettlementRow(data as Record<string, unknown>),
    error: null,
  };
}
