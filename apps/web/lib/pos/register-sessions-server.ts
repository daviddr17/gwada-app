import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RegisterSessionRow = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash_cents: number;
  closing_cash_cents: number | null;
  expected_cash_cents: number | null;
  cash_difference_cents: number | null;
  z_nr: number | null;
  cash_point_closing_id: string | null;
  dsfinvk_business_date: string | null;
};

export async function listClosedRegisterSessions(
  restaurantId: string,
  limit = 30,
): Promise<RegisterSessionRow[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("pos_register_sessions")
    .select(
      "id, opened_at, closed_at, opening_cash_cents, closing_cash_cents, expected_cash_cents, cash_difference_cents, z_nr, cash_point_closing_id, dsfinvk_business_date",
    )
    .eq("restaurant_id", restaurantId)
    .not("closed_at", "is", null)
    .order("closed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[pos] list register sessions", error.message);
    return [];
  }

  return (data ?? []) as RegisterSessionRow[];
}

export async function getRegisterSessionForRestaurant(
  restaurantId: string,
  sessionId: string,
): Promise<RegisterSessionRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("pos_register_sessions")
    .select(
      "id, opened_at, closed_at, opening_cash_cents, closing_cash_cents, expected_cash_cents, cash_difference_cents, z_nr, cash_point_closing_id, dsfinvk_business_date",
    )
    .eq("restaurant_id", restaurantId)
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) return null;
  return data as RegisterSessionRow;
}
